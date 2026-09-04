import { neon } from "@neondatabase/serverless";
import { compare, hash } from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import type { RoomState } from "./rooms";
import { applyMove, applyWall, type Pos, type Wall } from "./quoridor";

const databaseUrl = process.env["DATABASE_URL"];
const jwtSecret = process.env["JWT_SECRET"];
const sql = databaseUrl ? neon(databaseUrl) : null;
const secret = new TextEncoder().encode(jwtSecret ?? "development-only-change-me");
let schemaPromise: Promise<void> | null = null;

type User = { id: string; email: string; username: string; points: number; games: number; wins: number; losses: number; streak: number; last_played: string | null; disabled?: boolean; last_active_at?: string | null };
type Room = { id: string; code: string; is_public: boolean; status: string; p1_token: string | null; p1_name: string | null; p2_token: string | null; p2_name: string | null; state: RoomState; winner: number | null; created_at: string; updated_at: string };

function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers });
}
function error(message: string, status = 400) { return response({ error: message }, status); }
function cookieHeader(token: string, maxAge: number) { return `wallrush_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`; }
function cookies(request: Request) { return Object.fromEntries((request.headers.get("cookie") ?? "").split(";").filter(Boolean).map((part) => { const [key, ...value] = part.trim().split("="); return [key, value.join("=")]; })); }
async function body(request: Request): Promise<any> { try { return await request.json(); } catch { return null; } }
function text(value: unknown, max = 80) { return typeof value === "string" && value.trim().length > 0 && value.length <= max ? value.trim() : null; }
function email(value: unknown) { const result = text(value, 254)?.toLowerCase(); return result && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) ? result : null; }
function serializeUser(row: User) { return { id: row.id, email: row.email, username: row.username, points: row.points, games: row.games, wins: row.wins, losses: row.losses, streak: row.streak, last_played: row.last_played }; }
async function sessionUser(request: Request): Promise<User | null> {
  const token = cookies(request).wallrush_session;
  if (!token || !sql) return null;
  try { const { payload } = await jwtVerify(token, secret); const rows = await sql`UPDATE users SET last_active_at=now() WHERE id=${String(payload.sub)} AND disabled=false RETURNING id,email,username,points,games,wins,losses,streak,last_played,disabled,last_active_at`; return rows[0] as User ?? null; } catch { return null; }
}
async function issueSession(user: User) { return new SignJWT({ email: user.email, username: user.username }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime("30d").sign(secret); }
async function ensureSchema() {
  if (!sql) throw new Error("DATABASE_URL is not configured");
  schemaPromise ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, password_hash text NOT NULL, username text NOT NULL UNIQUE, points integer NOT NULL DEFAULT 0, games integer NOT NULL DEFAULT 0, wins integer NOT NULL DEFAULT 0, losses integer NOT NULL DEFAULT 0, streak integer NOT NULL DEFAULT 0, last_played date, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at timestamptz`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email))`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username))`;
    await sql`CREATE TABLE IF NOT EXISTS rooms (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, is_public boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'waiting', p1_token text, p1_name text, p2_token text, p2_name text, is_bot boolean NOT NULL DEFAULT false, state jsonb NOT NULL, winner integer, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false`;
    await sql`CREATE INDEX IF NOT EXISTS rooms_waiting_public_idx ON rooms (is_public, status, created_at DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS matches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, opponent_type text NOT NULL, opponent_name text, result text NOT NULL, points integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, username text NOT NULL, rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5), comment text, likes integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`;
  })();
  return schemaPromise;
}
function makeCode() { const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(""); }
function room(row: Record<string, unknown>): Room { return row as unknown as Room; }
function advanceRoomClock(state: RoomState, mover: 0 | 1): RoomState["clocks"] {
  const elapsed = (Date.now() - state.clocks.lastMoveAt) / 1000;
  const base: [number, number] = [...state.clocks.base] as [number, number];
  base[mover] = Math.max(0, base[mover] - elapsed);
  return { base, lastMoveAt: Date.now() };
}

export async function handleApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  try {
    await ensureSchema();
    if (!sql) return error("Backend is not configured", 503);
    const path = url.pathname;
    const legacyRoomMatch = path.match(/^\/api\/rooms\/([A-Z0-9]+)$/);
    if (legacyRoomMatch && request.method === "PATCH") {
      const input: any = await body(request);
      if (input?.action === "join") {
        const token = text(input.token, 100);
        const name = text(input.name, 80);
        if (!token || !name) return error("Player identity is required.");
        const rows = await sql`SELECT * FROM rooms WHERE code=${legacyRoomMatch[1]} LIMIT 1`;
        const current: any = rows[0];
        if (!current) return error("Room not found.", 404);
        if (current.p1_token === token || current.p2_token) return response({ room: room(current) });
        const updated = await sql`UPDATE rooms SET p2_token=${token},p2_name=${name},is_bot=false,status='playing',updated_at=now() WHERE code=${legacyRoomMatch[1]} AND p2_token IS NULL RETURNING *`;
        return updated[0] ? response({ room: room(updated[0]) }) : error("That room is already full.", 409);
      }
      return error("Room state must be changed with a validated room action.", 400);
    }
    const actionMatch = path.match(/^\/api\/rooms\/([A-Z0-9]+)\/action$/);
    if (actionMatch && request.method === "PATCH") {
      const input: any = await body(request);
      const token = text(input?.token, 100);
      const expectedMoveCount = input?.expectedMoveCount;
      const action = input?.action;
      if (!token || !Number.isInteger(expectedMoveCount) || !action?.type) return error("Invalid room action.");
      const rows = await sql`SELECT * FROM rooms WHERE code=${actionMatch[1]} LIMIT 1`;
      const current: any = rows[0];
      if (!current) return error("Room not found.", 404);
      const seat = current.p1_token === token ? 0 : current.p2_token === token ? 1 : null;
      if (seat === null) return error("You are not in this room.", 403);
      const currentState = current.state as RoomState;
      if (currentState.game.moveCount !== expectedMoveCount) return error("That game state is out of date.", 409);
      const game = currentState.game;
      let nextState: RoomState = currentState;
      let nextStatus = current.status;
      let nextWinner = current.winner;
      let requiresTurn = true;
      if (action.type === "move" && action.to && Number.isInteger(action.to.r) && Number.isInteger(action.to.c)) {
        const nextGame = applyMove(game, action.to as Pos);
        if (nextGame.moveCount === game.moveCount) return error("That move is not legal.", 409);
        nextState = { ...currentState, game: nextGame, clocks: advanceRoomClock(currentState, seat) };
        if (nextGame.winner !== null) { nextStatus = "done"; nextWinner = nextGame.winner; }
      } else if (action.type === "wall" && action.wall && (action.wall.o === "h" || action.wall.o === "v") && Number.isInteger(action.wall.r) && Number.isInteger(action.wall.c)) {
        const nextGame = applyWall(game, action.wall as Wall);
        if (nextGame.moveCount === game.moveCount) return error("That wall is not legal.", 409);
        nextState = { ...currentState, game: nextGame, clocks: advanceRoomClock(currentState, seat) };
      } else if (action.type === "resign") {
        nextState = { ...currentState, resignedBy: seat };
        nextStatus = "done";
        nextWinner = seat === 0 ? 1 : 0;
      } else if (action.type === "emote" && typeof action.emoji === "string" && action.emoji.length <= 8) {
        requiresTurn = false;
        nextState = { ...currentState, emote: { seat, emoji: action.emoji, at: Date.now() } };
      } else if (action.type === "rematch") {
        nextState = { ...currentState, game: { pawns: [{ r: 8, c: 4 }, { r: 0, c: 4 }], walls: [], wallsLeft: [10, 10], turn: 0, winner: null, moveCount: 0, history: [] }, clocks: { base: [300, 300], lastMoveAt: Date.now() }, resignedBy: null, rematch: [false, false] };
        nextStatus = "playing";
        nextWinner = null;
      } else return error("Invalid room action.");
      const updated = requiresTurn
        ? await sql`UPDATE rooms SET state=${JSON.stringify(nextState)}::jsonb,status=${nextStatus},winner=${nextWinner},updated_at=now() WHERE code=${actionMatch[1]} AND state->'game'->>'moveCount'=${String(expectedMoveCount)} AND ((p1_token=${token} AND state->'game'->>'turn'='0') OR (p2_token=${token} AND state->'game'->>'turn'='1')) RETURNING *`
        : await sql`UPDATE rooms SET state=${JSON.stringify(nextState)}::jsonb,status=${nextStatus},winner=${nextWinner},updated_at=now() WHERE code=${actionMatch[1]} AND state->'game'->>'moveCount'=${String(expectedMoveCount)} AND (p1_token=${token} OR p2_token=${token}) RETURNING *`;
      if (!updated[0]) return error("That turn has already changed. Refreshing the game state.", 409);
      return response({ room: room(updated[0]) });
    }
    if (path === "/api/health" && request.method === "GET") {
      await sql`SELECT 1`;
      return response({ ok: true, database: "neon", schema: "ready" }, 200, { "cache-control": "no-store" });
    }
    if (path === "/api/auth/signup" && request.method === "POST") {
      const input = await body(request); const userEmail = email(input?.email); const password = typeof input?.password === "string" ? input.password : ""; const username = text(input?.username, 18) ?? `User${Math.floor(1000 + Math.random() * 9000)}`;
      if (!userEmail || password.length < 8) return error("Enter a valid email and a password of at least 8 characters.");
      if (!/^[a-zA-Z0-9 _-]+$/.test(username)) return error("Username contains invalid characters.");
      const existing = await sql`SELECT email,username FROM users WHERE lower(email)=lower(${userEmail}) OR lower(username)=lower(${username}) LIMIT 1`;
      if (existing[0]) return error(existing[0]["email"]?.toLowerCase() === userEmail ? "An account with that email already exists." : "That username is already taken.", 409);
      const rows = await sql`INSERT INTO users (email,password_hash,username) VALUES (${userEmail},${await hash(password, 12)},${username}) RETURNING id,email,username,points,games,wins,losses,streak,last_played`;
      const token = await issueSession(rows[0] as User); return response({ user: serializeUser(rows[0] as User) }, 201, { "Set-Cookie": cookieHeader(token, 60 * 60 * 24 * 30) });
    }
    if (path === "/api/auth/login" && request.method === "POST") {
      const input = await body(request); const userEmail = email(input?.email); const password = typeof input?.password === "string" ? input.password : "";
      if (!userEmail || !password) return error("Email and password are required.");
      const rows = await sql`SELECT id,email,username,password_hash,points,games,wins,losses,streak,last_played,disabled,last_active_at FROM users WHERE email=${userEmail} LIMIT 1`; const user = rows[0] as (User & { password_hash: string }) | undefined;
      if (!user || !(await compare(password, user.password_hash))) return error("Email or password is incorrect.", 401);
      if (user.disabled) return error("This account is disabled.", 403);
      const token = await issueSession(user); return response({ user: serializeUser(user) }, 200, { "Set-Cookie": cookieHeader(token, 60 * 60 * 24 * 30) });
    }
    if (path === "/api/auth/session" && request.method === "GET") { const user = await sessionUser(request); return response({ user: user ? serializeUser(user) : null }); }
    if (path === "/api/auth/logout" && request.method === "POST") return response({ ok: true }, 200, { "Set-Cookie": cookieHeader("", 0) });
    if (path === "/api/profile" && request.method === "PATCH") {
      const user = await sessionUser(request); if (!user) return error("Please sign in.", 401); const input = await body(request); const username = text(input?.username, 18); if (!username) return error("Enter a display name.");
      const rows = await sql`UPDATE users SET username=${username} WHERE id=${user.id} RETURNING id,email,username,points,games,wins,losses,streak,last_played`; return response({ user: serializeUser(rows[0] as User) });
    }
    if (path === "/api/ranking" && request.method === "GET") { const rows = await sql`SELECT id,username,points,games,wins FROM users ORDER BY points DESC, wins DESC LIMIT 50`; return response({ rows }); }
    if (path === "/api/online-count" && request.method === "GET") { const rows = await sql`SELECT COUNT(DISTINCT player_token)::int AS count FROM (SELECT p1_token AS player_token FROM rooms WHERE updated_at > now() - interval '5 minutes' UNION ALL SELECT p2_token AS player_token FROM rooms WHERE updated_at > now() - interval '5 minutes') active WHERE player_token IS NOT NULL`; return response({ count: Number(rows[0]?.["count"] ?? 0) }); }
    if (path === "/api/matches" && request.method === "POST") {
      const user = await sessionUser(request); if (!user) return error("Please sign in.", 401); const input = await body(request); const opponentType = text(input?.opponentType, 30); const result = input?.result === "win" ? "win" : input?.result === "loss" ? "loss" : null; const points = typeof input?.points === "number" && Number.isInteger(input.points) ? input.points : 0; const ranked = input?.ranked === true; if (!opponentType || !result) return error("Invalid match."); await sql`INSERT INTO matches (user_id,opponent_type,opponent_name,result,points) VALUES (${user.id},${opponentType},${text(input?.opponentName, 80)},${result},${ranked ? points : 0})`; if (ranked) await sql`UPDATE users SET points=GREATEST(0,points+${points}), games=games+1, wins=wins+${result === "win" ? 1 : 0}, losses=losses+${result === "loss" ? 1 : 0}, last_played=CURRENT_DATE WHERE id=${user.id}`; return response({ ok: true }, 201);
    }
    if (path === "/api/reviews" && request.method === "GET") { const rows = await sql`SELECT id,username,rating,comment,likes,created_at FROM reviews ORDER BY created_at DESC LIMIT 50`; return response({ rows }); }
    if (path === "/api/reviews" && request.method === "POST") { const user = await sessionUser(request); if (!user) return error("Please sign in.", 401); const input = await body(request); const rating = Number(input?.rating); if (!Number.isInteger(rating) || rating < 1 || rating > 5) return error("Rating must be between 1 and 5."); const rows = await sql`INSERT INTO reviews (user_id,username,rating,comment) VALUES (${user.id},${user.username},${rating},${text(input?.comment, 1000)}) RETURNING id,username,rating,comment,likes,created_at`; return response({ review: rows[0] }, 201); }
    if (path === "/api/rooms" && request.method === "GET") { const code = url.searchParams.get("code")?.toUpperCase(); if (code) { const rows = await sql`SELECT * FROM rooms WHERE code=${code} LIMIT 1`; const current: any = rows[0]; if (current && current["is_public"] && current["status"] === "waiting" && !current["p2_token"] && Date.now() - new Date(current["created_at"]).getTime() >= 7000) { const started = await sql`UPDATE rooms SET p2_token=${`__BOT__:${code}`},p2_name='Viktor',is_bot=true,status='playing',updated_at=now() WHERE code=${code} AND p2_token IS NULL AND status='waiting' RETURNING *`; return response({ room: room(started[0] ?? current) }); } return response({ room: current ? room(current) : null }); } await sql`UPDATE rooms SET p2_token='__BOT__:' || code,p2_name='Viktor',is_bot=true,status='playing',updated_at=now() WHERE is_public=true AND status='waiting' AND p2_token IS NULL AND created_at <= now() - interval '7 seconds'`; const rows = await sql`SELECT * FROM rooms WHERE is_public=true AND status='waiting' ORDER BY created_at DESC LIMIT 30`; return response({ rooms: rows.map(room) }); }
    if (path === "/api/rooms/bot" && request.method === "POST") { const input = await body(request); const code = text(input?.code, 6)?.toUpperCase(); const token = text(input?.token, 100); if (!code || !token) return error("Room identity is required."); const rows = await sql`SELECT * FROM rooms WHERE code=${code} AND is_public=true AND p1_token=${token} LIMIT 1`; const current = rows[0]; if (!current) return error("Room not found.", 404); if ((current as any)["p2_token"]) return response({ room: room(current) }); const updated = await sql`UPDATE rooms SET p2_token=${`__BOT__:${code}`},p2_name='Viktor',is_bot=true,status='playing',updated_at=now() WHERE code=${code} AND p2_token IS NULL RETURNING *`; return updated[0] ? response({ room: room(updated[0]) }) : error("Could not start bot match.", 409); }
    if (path === "/api/rooms" && request.method === "POST") { const input = await body(request); const token = text(input?.token, 100); const name = text(input?.name, 80); if (!token || !name) return error("Player identity is required."); const isPublic = input?.isPublic === true; const code = makeCode(); const state = input?.state ?? { game: { pawns: [{ r: 8, c: 4 }, { r: 0, c: 4 }], walls: [], wallsLeft: [10, 10], turn: 0, winner: null, history: [], moveCount: 0 }, clocks: { base: [300, 300], lastMoveAt: Date.now() }, rematch: [false, false], resignedBy: null }; const rows = await sql`INSERT INTO rooms (code,is_public,status,p1_token,p1_name,state) VALUES (${code},${isPublic},'waiting',${token},${name},${JSON.stringify(state)}::jsonb) RETURNING *`; const created = rows[0]; return created ? response({ room: room(created) }, 201) : error("Could not create room.", 500); }
    const match = path.match(/^\/api\/rooms\/([A-Z0-9]+)$/); if (match) { const code = match[1]; if (request.method === "GET") { const rows = await sql`SELECT * FROM rooms WHERE code=${code} LIMIT 1`; return rows[0] ? response({ room: room(rows[0]) }) : error("Room not found.", 404); } if (request.method === "DELETE") { const input: any = await body(request); const token = text(input?.token, 100); if (!token) return error("Player identity is required."); const rows = await sql`SELECT * FROM rooms WHERE code=${code} LIMIT 1`; const current: any = rows[0]; if (!current) return error("Room not found.", 404); if (current["p1_token"] === token) { if (current["p2_token"] && !current["is_bot"]) await sql`UPDATE rooms SET p1_token=p2_token,p1_name=p2_name,p2_token=NULL,p2_name=NULL,is_bot=false,status='waiting',updated_at=now() WHERE code=${code}`; else await sql`DELETE FROM rooms WHERE code=${code}`; return response({ ok: true }); } if (current["p2_token"] === token) { await sql`UPDATE rooms SET p2_token=NULL,p2_name=NULL,is_bot=false,status='waiting',updated_at=now() WHERE code=${code}`; return response({ ok: true }); } return error("You are not in this room.", 403); } if (request.method === "PATCH") { const input: any = await body(request); const token = text(input?.token, 100); const name = text(input?.name, 80); const rows = await sql`SELECT * FROM rooms WHERE code=${code} LIMIT 1`; const current: any = rows[0]; if (!current) return error("Room not found.", 404); if (input?.action === "join") { if (current["p1_token"] === token || current["p2_token"]) return response({ room: room(current) }); const updated = await sql`UPDATE rooms SET p2_token=${token},p2_name=${name},is_bot=false,status='playing',updated_at=now() WHERE code=${code} AND p2_token IS NULL RETURNING *`; return updated[0] ? response({ room: room(updated[0]!) }) : error("That room is already full.", 409); } if (input?.state) { if (!token || (current["p1_token"] !== token && current["p2_token"] !== token)) return error("You are not in this room.", 403); const updated = await sql`UPDATE rooms SET state=${JSON.stringify(input.state)}::jsonb,status=${input.status ?? current["status"]},winner=${input.winner ?? current["winner"]},updated_at=now() WHERE code=${code} RETURNING *`; const saved = updated[0]; return saved ? response({ room: room(saved) }) : error("Could not save room.", 500); } return error("Invalid room action."); } }
    return error("API route not found.", 404);
  } catch (caught) { const requestId = crypto.randomUUID(); console.error(`[api:${requestId}]`, caught); const duplicate = caught instanceof Error && caught.message.includes("duplicate key"); return new Response(JSON.stringify({ error: duplicate ? "That email, username, or room code is already in use." : "Request could not be completed.", requestId }), { status: duplicate ? 409 : 500, headers: { "content-type": "application/json", "cache-control": "no-store", "x-request-id": requestId } }); }
}
