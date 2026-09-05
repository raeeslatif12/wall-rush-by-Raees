export type AdminRole = "admin" | "super_admin";
export interface AdminIdentity { id: string; username: string; role: AdminRole }
export interface AdminAccount { id: string; username: string; role: AdminRole; created_at: string }
export interface AdminUser { id: string; email: string; username: string; points: number; games: number; wins: number; losses: number; streak: number; disabled: boolean; walls_per_player: number | null; created_at: string; last_active_at: string | null; rank?: number; match_count?: number }
export interface SocialLink { id: string; label: string; url: string; icon: string; enabled: boolean; position: number; created_at: string; updated_at: string }
export interface GameSettings { wallsPerPlayer: number }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers); if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include" }); const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error ?? "Admin request failed"); return payload;
}

export const adminApi = {
  session: () => request<{ admin: AdminIdentity }>("/api/admin/session"),
  login: (username: string, password: string) => request<{ admin: AdminIdentity }>("/api/admin/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  admins: () => request<{ admins: AdminAccount[] }>("/api/admin/admins"),
  createAdmin: (username: string, password: string) => request<{ admin: AdminAccount }>("/api/admin/admins", { method: "POST", body: JSON.stringify({ username, password }) }),
  deleteAdmin: (id: string) => request<{ ok: true }>(`/api/admin/admins/${id}`, { method: "DELETE" }),
  updateAdminPassword: (id: string, password: string) => request<{ ok: true }>(`/api/admin/admins/${id}`, { method: "PATCH", body: JSON.stringify({ password }) }),
  updateProfile: (username: string, password: string) => request<{ admin: AdminIdentity }>("/api/admin/profile", { method: "PATCH", body: JSON.stringify({ username, ...(password ? { password } : {}) }) }),
  logout: () => request<{ ok: true }>("/api/admin/logout", { method: "POST" }),
  overview: () => request<{ stats: Record<string, number> }>("/api/admin/overview"),
    gameSettings: () => request<{ settings: GameSettings }>("/api/admin/game-settings"),
    updateGameSettings: (settings: GameSettings) => request<{ settings: GameSettings }>("/api/admin/game-settings", { method: "PATCH", body: JSON.stringify(settings) }),
  users: (search = "") => request<{ users: AdminUser[] }>(`/api/admin/users?search=${encodeURIComponent(search)}`),
  user: (id: string) => request<{ user: AdminUser }>(`/api/admin/users/${id}`),
  userMatches: (id: string) => request<{ matches: any[] }>(`/api/admin/users/${id}/matches`),
  updateUser: (id: string, changes: Record<string, unknown>) => request<{ ok: true }>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(changes) }),
  deleteUser: (id: string) => request<{ ok: true }>(`/api/admin/users/${id}`, { method: "DELETE" }),
  matches: () => request<{ matches: any[] }>("/api/admin/matches"),
  match: (id: string) => request<{ match: any | null; room: any | null }>(`/api/admin/matches/${id}`),
  rooms: () => request<{ rooms: any[] }>("/api/admin/rooms"),
  analytics: () => request<{ growth: any[]; visits: any[]; dailyMatches: any[]; split: any[] }>("/api/admin/analytics"),
  activity: () => request<{ activity: any[] }>("/api/admin/activity"),
  socialLinks: () => request<{ links: SocialLink[] }>("/api/admin/social-links"),
  createSocialLink: (data: Pick<SocialLink, "label" | "url" | "icon" | "enabled" | "position">) => request<{ link: SocialLink }>("/api/admin/social-links", { method: "POST", body: JSON.stringify(data) }),
  updateSocialLink: (id: string, data: Partial<Pick<SocialLink, "label" | "url" | "icon" | "enabled" | "position">>) => request<{ link: SocialLink }>(`/api/admin/social-links/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSocialLink: (id: string) => request<{ ok: true }>(`/api/admin/social-links/${id}`, { method: "DELETE" }),
};
