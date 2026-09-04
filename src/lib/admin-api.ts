export interface AdminUser { id: string; email: string; username: string; points: number; games: number; wins: number; losses: number; streak: number; disabled: boolean; created_at: string; last_active_at: string | null; rank?: number; match_count?: number }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers); if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include" }); const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error ?? "Admin request failed"); return payload;
}

export const adminApi = {
  session: () => request<{ admin: { username: string } }>("/api/admin/session"),
  login: (username: string, password: string) => request<{ admin: { username: string } }>("/api/admin/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request<{ ok: true }>("/api/admin/logout", { method: "POST" }),
  overview: () => request<{ stats: Record<string, number> }>("/api/admin/overview"),
  users: (search = "") => request<{ users: AdminUser[] }>(`/api/admin/users?search=${encodeURIComponent(search)}`),
  user: (id: string) => request<{ user: AdminUser }>(`/api/admin/users/${id}`),
  userMatches: (id: string) => request<{ matches: any[] }>(`/api/admin/users/${id}/matches`),
  updateUser: (id: string, changes: Record<string, unknown>) => request<{ ok: true }>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(changes) }),
  deleteUser: (id: string) => request<{ ok: true }>(`/api/admin/users/${id}`, { method: "DELETE" }),
  matches: () => request<{ matches: any[] }>("/api/admin/matches"),
  rooms: () => request<{ rooms: any[] }>("/api/admin/rooms"),
  analytics: () => request<{ growth: any[]; visits: any[]; dailyMatches: any[]; split: any[] }>("/api/admin/analytics"),
  activity: () => request<{ activity: any[] }>("/api/admin/activity"),
};
