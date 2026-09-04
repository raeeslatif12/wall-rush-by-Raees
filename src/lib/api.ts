import type { LocalData } from "./local";
import type { Room, RoomState } from "./rooms";

export interface ApiUser {
  id: string;
  email: string;
  username: string;
  points: number;
  games: number;
  wins: number;
  losses: number;
  streak: number;
  last_played: string | null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error ?? "Request failed");
  return payload;
}

export const api = {
  session: () => request<{ user: ApiUser | null }>("/api/auth/session"),
  signup: (email: string, password: string, username: string) => request<{ user: ApiUser }>("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password, username }) }),
  login: (email: string, password: string) => request<{ user: ApiUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  updateProfile: (username: string) => request<{ user: ApiUser }>("/api/profile", { method: "PATCH", body: JSON.stringify({ username }) }),
  recordMatch: (data: { opponentType: string; opponentName?: string | undefined; result: "win" | "loss"; points: number; ranked: boolean }) => request<{ ok: true }>("/api/matches", { method: "POST", body: JSON.stringify(data) }),
  ranking: () => request<{ rows: Array<{ id: string; username: string; points: number; wins: number; games: number }> }>("/api/ranking"),
  reviews: () => request<{ rows: Array<{ id: string; username: string; rating: number; comment: string | null; likes: number; created_at: string }> }>("/api/reviews"),
  addReview: (data: { rating: number; comment: string | null }) => request("/api/reviews", { method: "POST", body: JSON.stringify(data) }),
  rooms: () => request<{ rooms: Room[] }>("/api/rooms"),
  onlineCount: () => request<{ count: number }>("/api/online-count"),
  room: (code: string) => request<{ room: Room | null }>(`/api/rooms?code=${encodeURIComponent(code.toUpperCase())}`),
  createRoom: (data: { isPublic: boolean; token: string; name: string; state: RoomState }) => request<{ room: Room }>("/api/rooms", { method: "POST", body: JSON.stringify(data) }),
  joinRoom: (code: string, token: string, name: string) => request<{ room: Room }>(`/api/rooms/${code.toUpperCase()}`, { method: "PATCH", body: JSON.stringify({ action: "join", token, name }) }),
  saveRoom: (code: string, token: string, state: RoomState, extra: { status?: string; winner?: number | null }) => request<{ room: Room }>(`/api/rooms/${code.toUpperCase()}`, { method: "PATCH", body: JSON.stringify({ token, state, ...extra }) }),
  leaveRoom: (code: string, token: string) => request<{ ok: true }>(`/api/rooms/${code.toUpperCase()}`, { method: "DELETE", body: JSON.stringify({ token }) }),
  startBot: (code: string, token: string) => request<{ room: Room }>("/api/rooms/bot", { method: "POST", body: JSON.stringify({ code, token }) }),
};

export function apiUserToSession(user: ApiUser | null) {
  return user ? { user: { id: user.id, email: user.email } } : null;
}

export type { LocalData };
