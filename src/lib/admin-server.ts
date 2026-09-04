import { neon } from "@neondatabase/serverless";
import { compare, hash } from "bcryptjs";
import { createHash } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

const sql = process.env["DATABASE_URL"] ? neon(process.env["DATABASE_URL"]!) : null;
const adminSecret = new TextEncoder().encode(process.env["ADMIN_JWT_SECRET"] ?? process.env["JWT_SECRET"] ?? "development-only-admin-secret");
let adminSchemaPromise: Promise<void> | null = null;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) { return Response.json(body, { status, headers }); }
function fail(message: string, status = 400) { return json({ error: message }, status); }
function cookies(request: Request) { return Object.fromEntries((request.headers.get("cookie") ?? "").split(";").filter(Boolean).map((part) => { const [key, ...value] = part.trim().split("="); return [key, value.join("=")]; })); }
function cookie(value: string, maxAge: number) { return `admin_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`; }
async function body(request: Request): Promise<any> { try { return await request.json(); } catch { return null; } }
function text(value: unknown, max = 120) { return typeof value === "string" && value.trim() && value.length <= max ? value.trim() : null; }
function adminUsername(value: unknown) { const username = text(value, 40); return username && username.length >= 3 && /^[a-zA-Z0-9_. -]+$/.test(username) ? username : null; }
function dateFilter(period: string) { return period === "month" ? "30 days" : period === "week" ? "7 days" : "1 day"; }

async function ensureAdminSchema() {
  if (!sql) throw new Error("DATABASE_URL is not configured");
  adminSchemaPromise ??= (async () => {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at timestamptz`;
    await sql`CREATE TABLE IF NOT EXISTS admins (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL UNIQUE, password_hash text NOT NULL, role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin'`;
    await sql`UPDATE admins SET role='admin' WHERE role IS NULL OR role NOT IN ('admin', 'super_admin')`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS admins_username_lower_idx ON admins (lower(username))`;
    const configuredUsername = adminUsername(process.env["ADMIN_USERNAME"]);
    const configuredHash = process.env["ADMIN_PASSWORD_HASH"];
    if (configuredUsername && configuredHash) {
      await sql`INSERT INTO admins (username,password_hash,role) VALUES (${configuredUsername},${configuredHash},'super_admin') ON CONFLICT DO NOTHING`;
      await sql`UPDATE admins SET role='super_admin' WHERE lower(username)=lower(${configuredUsername})`;
    }
    await sql`CREATE TABLE IF NOT EXISTS visitor_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visitor_key text NOT NULL, visit_date date NOT NULL DEFAULT CURRENT_DATE, path text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(visitor_key, visit_date))`;
    await sql`CREATE INDEX IF NOT EXISTS visitor_events_date_idx ON visitor_events (visit_date, created_at)`;
    await sql`CREATE TABLE IF NOT EXISTS admin_activity (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action text NOT NULL, actor text NOT NULL, target_id uuid, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE INDEX IF NOT EXISTS admin_activity_created_idx ON admin_activity (created_at DESC)`;
  })();
  return adminSchemaPromise;
}

async function adminUser(request: Request) {
  const token = cookies(request).admin_session;
  if (!token || !sql) return null;
  try {
    const { payload } = await jwtVerify(token, adminSecret);
    if ((payload["role"] !== "admin" && payload["role"] !== "super_admin") || typeof payload.sub !== "string") return null;
    const rows = await sql`SELECT id,username,role FROM admins WHERE id=${payload.sub}`;
    return rows[0] ? { id: rows[0].id as string, username: rows[0].username as string, role: rows[0].role as "admin" | "super_admin" } : null;
  } catch { return null; }
}
async function audit(action: string, actor: string, targetId: string | null = null, details: Record<string, unknown> = {}) { if (sql) await sql`INSERT INTO admin_activity (action,actor,target_id,details) VALUES (${action},${actor},${targetId},${JSON.stringify(details)}::jsonb)`; }
async function issueAdmin(id: string, role: "admin" | "super_admin") { return new SignJWT({ role }).setProtectedHeader({ alg: "HS256" }).setSubject(id).setIssuedAt().setExpirationTime("8h").sign(adminSecret); }
function cleanUser(row: any) { return { ...row, disabled: Boolean(row.disabled) }; }

export async function trackVisitor(request: Request) {
  if (!sql || new URL(request.url).pathname.startsWith("/api/") || request.method !== "GET") return;
  try {
    await ensureAdminSchema();
    const url = new URL(request.url);
    const source = `${request.headers.get("x-forwarded-for") ?? "unknown"}|${request.headers.get("user-agent") ?? "unknown"}`;
    const visitorKey = createHash("sha256").update(source).digest("hex");
    await sql`INSERT INTO visitor_events (visitor_key,path) VALUES (${visitorKey},${url.pathname}) ON CONFLICT (visitor_key,visit_date) DO NOTHING`;
  } catch (error) { console.error("visitor tracking failed", error); }
}

export async function handleAdminApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/admin")) return null;
  try {
    if (!sql) return fail("Admin backend is not configured. Set DATABASE_URL and restart the server.", 503);
    await ensureAdminSchema();
    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      const input = await body(request); const username = adminUsername(input?.username); const password = typeof input?.password === "string" ? input.password : "";
      const rows = username ? await sql`SELECT id,username,password_hash,role FROM admins WHERE lower(username)=lower(${username})` : [];
      if (!rows[0] || !(await compare(password, rows[0].password_hash))) return fail("Invalid admin credentials.", 401);
      const admin = { id: rows[0].id as string, username: rows[0].username as string, role: rows[0].role as "admin" | "super_admin" }; const token = await issueAdmin(admin.id, admin.role); await audit("admin_login", admin.username); return json({ admin }, 200, { "Set-Cookie": cookie(token, 60 * 60 * 8) });
    }
    if (url.pathname === "/api/admin/logout" && request.method === "POST") { const actor = await adminUser(request); if (actor) await audit("admin_logout", actor.username); return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) }); }
    const actor = await adminUser(request); if (!actor) return fail("Admin authentication required.", 401);
    if (url.pathname === "/api/admin/session" && request.method === "GET") return json({ admin: actor });
    if (url.pathname === "/api/admin/admins" && request.method === "GET") {
      if (actor.role !== "super_admin") return fail("Super admin access required.", 403);
      const admins = await sql`SELECT id,username,created_at FROM admins ORDER BY created_at ASC`;
      return json({ admins });
    }
    if (url.pathname === "/api/admin/admins" && request.method === "POST") {
      if (actor.role !== "super_admin") return fail("Super admin access required.", 403);
      const input = await body(request); const username = adminUsername(input?.username); const password = typeof input?.password === "string" ? input.password : "";
      if (!username) return fail("Use 3-40 letters, numbers, spaces, dots, dashes, or underscores.");
      if (password.length < 8) return fail("The password must be at least 8 characters.");
      const rows = await sql`INSERT INTO admins (username,password_hash) VALUES (${username},${await hash(password, 12)}) RETURNING id,username,created_at`;
      await audit("admin_created", actor.username, rows[0].id, { username }); return json({ admin: rows[0] }, 201);
    }
    const adminMatch = url.pathname.match(/^\/api\/admin\/admins\/([0-9a-f-]+)$/i);
    if (adminMatch && request.method === "DELETE") {
      if (actor.role !== "super_admin") return fail("Super admin access required.", 403);
      const id = adminMatch[1];
      if (id === actor.id) return fail("You cannot delete your own administrator account.", 400);
      const target = await sql`SELECT id,username,role FROM admins WHERE id=${id}`;
      if (!target[0]) return fail("Administrator not found.", 404);
      if (target[0].role === "super_admin") {
        const remaining = await sql`SELECT COUNT(*)::int AS count FROM admins WHERE role='super_admin' AND id <> ${id}`;
        if (Number(remaining[0]?.count ?? 0) < 1) return fail("Keep at least one super administrator.", 400);
      }
      await sql`DELETE FROM admins WHERE id=${id}`;
      await audit("admin_deleted", actor.username, id, { username: target[0].username });
      return json({ ok: true });
    }
    if (adminMatch && request.method === "PATCH") {
      if (actor.role !== "super_admin") return fail("Super admin access required.", 403);
      const input = await body(request); const password = typeof input?.password === "string" ? input.password : "";
      if (password.length < 8) return fail("The password must be at least 8 characters.");
      const target = await sql`SELECT id,username FROM admins WHERE id=${adminMatch[1]}`;
      if (!target[0]) return fail("Administrator not found.", 404);
      await sql`UPDATE admins SET password_hash=${await hash(password, 12)},updated_at=now() WHERE id=${adminMatch[1]}`;
      await audit("admin_password_updated", actor.username, adminMatch[1], { username: target[0].username });
      return json({ ok: true });
    }
    if (url.pathname === "/api/admin/profile" && request.method === "PATCH") {
      const input = await body(request); const username = adminUsername(input?.username); const password = typeof input?.password === "string" ? input.password : "";
      if (!username) return fail("Use 3-40 letters, numbers, spaces, dots, dashes, or underscores.");
      if (password && password.length < 8) return fail("The password must be at least 8 characters.");
      if (password) await sql`UPDATE admins SET username=${username},password_hash=${await hash(password, 12)},updated_at=now() WHERE id=${actor.id}`;
      else await sql`UPDATE admins SET username=${username},updated_at=now() WHERE id=${actor.id}`;
      await audit("admin_profile_updated", actor.username, actor.id, { fields: password ? ["username", "password"] : ["username"] });
      const token = await issueAdmin(actor.id, actor.role); return json({ admin: { id: actor.id, username, role: actor.role } }, 200, { "Set-Cookie": cookie(token, 60 * 60 * 8) });
    }
    if (url.pathname === "/api/admin/overview" && request.method === "GET") {
      const [users, online, visitors, today, week, month, matches, activeRooms, waitingRooms, wins, losses, points, newToday, newWeek, newMonth, realMatches, botMatches] = await Promise.all([
        sql`SELECT COUNT(*)::int AS count FROM users`, sql`SELECT COUNT(DISTINCT player_token)::int AS count FROM (SELECT p1_token AS player_token FROM rooms WHERE updated_at > now() - interval '5 minutes' UNION ALL SELECT p2_token AS player_token FROM rooms WHERE updated_at > now() - interval '5 minutes') a WHERE player_token IS NOT NULL`,
        sql`SELECT COUNT(DISTINCT visitor_key)::int AS count FROM visitor_events`, sql`SELECT COUNT(DISTINCT visitor_key)::int AS count FROM visitor_events WHERE visit_date=CURRENT_DATE`, sql`SELECT COUNT(DISTINCT visitor_key)::int AS count FROM visitor_events WHERE visit_date >= CURRENT_DATE - 6`, sql`SELECT COUNT(DISTINCT visitor_key)::int AS count FROM visitor_events WHERE visit_date >= CURRENT_DATE - 29`,
        sql`SELECT COUNT(*)::int AS count FROM matches`, sql`SELECT COUNT(*)::int AS count FROM rooms WHERE status='playing'`, sql`SELECT COUNT(*)::int AS count FROM rooms WHERE status='waiting'`, sql`SELECT COALESCE(SUM(wins),0)::int AS count FROM users`, sql`SELECT COALESCE(SUM(losses),0)::int AS count FROM users`, sql`SELECT COALESCE(SUM(GREATEST(points,0)),0)::int AS count FROM matches`, sql`SELECT COUNT(*)::int AS count FROM users WHERE created_at::date=CURRENT_DATE`, sql`SELECT COUNT(*)::int AS count FROM users WHERE created_at >= CURRENT_DATE - 6`, sql`SELECT COUNT(*)::int AS count FROM users WHERE created_at >= CURRENT_DATE - 29`, sql`SELECT COUNT(*)::int AS count FROM matches WHERE opponent_type='human'`, sql`SELECT COUNT(*)::int AS count FROM matches WHERE opponent_type='ai'`,
      ]);
      const value = (result: any[]) => Number(result[0]?.["count"] ?? 0);
      return json({ stats: { users: value(users), online: value(online), visitors: value(visitors), visitorsToday: value(today), visitorsWeek: value(week), visitorsMonth: value(month), matches: value(matches), activeRooms: value(activeRooms), waitingRooms: value(waitingRooms), wins: value(wins), losses: value(losses), points: value(points), newToday: value(newToday), newWeek: value(newWeek), newMonth: value(newMonth), realMatches: value(realMatches), botMatches: value(botMatches) } });
    }
    if (url.pathname === "/api/admin/users" && request.method === "GET") {
      const search = text(url.searchParams.get("search"), 80); const rows = search ? await sql`SELECT u.*, ROW_NUMBER() OVER (ORDER BY points DESC,wins DESC)::int AS rank FROM users u WHERE username ILIKE ${`%${search}%`} OR email ILIKE ${`%${search}%`} ORDER BY points DESC LIMIT 100` : await sql`SELECT u.*, ROW_NUMBER() OVER (ORDER BY points DESC,wins DESC)::int AS rank FROM users u ORDER BY points DESC LIMIT 100`;
      return json({ users: rows.map(cleanUser) });
    }
    const userMatch = url.pathname.match(/^\/api\/admin\/users\/([0-9a-f-]+)(?:\/matches)?$/i);
    if (userMatch && request.method === "GET") { const id = userMatch[1]; if (url.pathname.endsWith("/matches")) return json({ matches: await sql`SELECT * FROM matches WHERE user_id=${id} ORDER BY created_at DESC LIMIT 200` }); const rows = await sql`SELECT u.*, (SELECT COUNT(*)::int FROM matches m WHERE m.user_id=u.id) AS match_count, ROW_NUMBER() OVER (ORDER BY points DESC,wins DESC)::int AS rank FROM users u WHERE u.id=${id}`; return rows[0] ? json({ user: cleanUser(rows[0]) }) : fail("User not found.", 404); }
    if (userMatch && request.method === "PATCH") { const id = userMatch[1]; const input = await body(request); const sets: string[] = []; const values: any[] = []; if (typeof input?.username === "string" && input.username.trim()) { sets.push("username"); values.push(input.username.trim()); } const numeric = ["points", "wins", "losses"] as const; for (const field of numeric) if (Number.isInteger(input?.[field])) { sets.push(field); values.push(input[field]); } if (typeof input?.disabled === "boolean") { sets.push("disabled"); values.push(input.disabled); } if (typeof input?.password === "string" && input.password.length >= 8) { sets.push("password_hash"); values.push(await hash(input.password, 12)); } if (!sets.length) return fail("No valid changes supplied."); const rows = await sql`SELECT id FROM users WHERE id=${id}`; if (!rows[0]) return fail("User not found.", 404); for (let i = 0; i < sets.length; i++) { const field = sets[i]; const value = values[i]; if (field === "username") await sql`UPDATE users SET username=${value} WHERE id=${id}`; if (field === "points") await sql`UPDATE users SET points=${value} WHERE id=${id}`; if (field === "wins") await sql`UPDATE users SET wins=${value} WHERE id=${id}`; if (field === "losses") await sql`UPDATE users SET losses=${value} WHERE id=${id}`; if (field === "disabled") await sql`UPDATE users SET disabled=${value} WHERE id=${id}`; if (field === "password_hash") await sql`UPDATE users SET password_hash=${value} WHERE id=${id}`; } await audit("user_updated", actor.username, id, { fields: sets }); return json({ ok: true }); }
    if (userMatch && request.method === "DELETE") { const id = userMatch[1]; await sql`DELETE FROM users WHERE id=${id}`; await audit("user_deleted", actor.username, id); return json({ ok: true }); }
    if (url.pathname === "/api/admin/matches" && request.method === "GET") return json({ matches: await sql`SELECT m.*,u.username FROM matches m JOIN users u ON u.id=m.user_id ORDER BY m.created_at DESC LIMIT 200` });
    if (url.pathname === "/api/admin/rooms" && request.method === "GET") return json({ rooms: await sql`SELECT id,code,is_public,status,p1_name,p2_name,is_bot,updated_at,created_at FROM rooms ORDER BY updated_at DESC LIMIT 200` });
    if (url.pathname === "/api/admin/activity" && request.method === "GET") return json({ activity: await sql`SELECT * FROM admin_activity ORDER BY created_at DESC LIMIT 200` });
    if (url.pathname === "/api/admin/analytics" && request.method === "GET") { const [growth, visits, dailyMatches, split] = await Promise.all([sql`SELECT created_at::date AS day,COUNT(*)::int AS count FROM users WHERE created_at >= CURRENT_DATE - 29 GROUP BY day ORDER BY day`, sql`SELECT visit_date AS day,COUNT(DISTINCT visitor_key)::int AS count FROM visitor_events WHERE visit_date >= CURRENT_DATE - 29 GROUP BY day ORDER BY day`, sql`SELECT created_at::date AS day,COUNT(*)::int AS count FROM matches WHERE created_at >= CURRENT_DATE - 29 GROUP BY day ORDER BY day`, sql`SELECT opponent_type AS type,COUNT(*)::int AS count FROM matches GROUP BY opponent_type`]); return json({ growth, visits, dailyMatches, split }); }
    return fail("Admin API route not found.", 404);
  } catch (caught) { console.error(caught); const duplicate = caught instanceof Error && caught.message.includes("duplicate"); return fail(duplicate ? "That value is already in use." : "Admin request failed.", duplicate ? 409 : 500); }
}
