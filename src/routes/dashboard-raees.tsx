import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Check,
  ChevronRight,
  CircleUserRound,
  DoorOpen,
  ExternalLink,
  Gauge,
  KeyRound,
  Link2,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Swords,
  Trash2,
  Trophy,
  Users,
  UserRoundCog,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  adminApi,
  type AdminAccount,
  type AdminIdentity,
  type AdminUser,
  type SocialLink,
} from "@/lib/admin-api";
import Board from "@/components/Board";

export const Route = createFileRoute("/dashboard-raees")({ component: AdminDashboard });

type Tab =
  | "overview"
  | "users"
  | "matches"
  | "rooms"
  | "rankings"
  | "analytics"
  | "activity"
  | "links"
  | "admins";
const tabs: Array<{ id: Tab; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "users", label: "Users", icon: Users },
  { id: "matches", label: "Matches", icon: Swords },
  { id: "rooms", label: "Live rooms", icon: DoorOpen },
  { id: "rankings", label: "Rankings", icon: Trophy },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "activity", label: "Audit log", icon: Activity },
  { id: "links", label: "Social links", icon: Link2 },
  { id: "admins", label: "Administrators", icon: UserRoundCog },
];
const navGroups: Array<{ label: string; ids: Tab[] }> = [
  { label: "Workspace", ids: ["overview", "analytics", "activity"] },
  { label: "Game operations", ids: ["rooms", "matches", "rankings"] },
  { label: "Directory", ids: ["users"] },
  { label: "Configuration", ids: ["links", "admins"] },
];
const number = new Intl.NumberFormat("en-US");
const date = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Never";

function AdminDashboard() {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [loginError, setLoginError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof window !== "undefined" && window.localStorage.getItem("wallrush-admin-theme") === "dark"
      ? "dark"
      : "light",
  );
  const [data, setData] = useState<any>({
    stats: {},
    users: [],
    matches: [],
    rooms: [],
    growth: [],
    visits: [],
    dailyMatches: [],
    split: [],
    activity: [],
    links: [],
  });

  async function load() {
    setRefreshing(true);
    try {
      const [overview, users, matches, rooms, analytics, activity, links] = await Promise.all([
        adminApi.overview(),
        adminApi.users(),
        adminApi.matches(),
        adminApi.rooms(),
        adminApi.analytics(),
        adminApi.activity(),
        adminApi.socialLinks(),
      ]);
      setData({ ...overview, ...users, ...matches, ...rooms, ...analytics, ...activity, ...links });
    } catch (error) {
      if (error instanceof Error && error.message.includes("authentication")) setAdmin(null);
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    window.localStorage.setItem("wallrush-admin-theme", theme);
  }, [theme]);
  useEffect(() => {
    adminApi
      .session()
      .then((result) => {
        setAdmin(result.admin);
      })
      .catch((caught) => {
        if (caught instanceof Error && !caught.message.includes("authentication"))
          setLoginError(caught.message);
      })
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    if (admin) void load();
  }, [admin]);
  if (checking) return <div className="admin-loading">Checking secure admin session...</div>;
  if (!admin) return <AdminLogin onLogin={setAdmin} error={loginError} setError={setLoginError} />;
  const stats = data.stats as Record<string, number>;
  const visibleTabs = tabs.filter(({ id }) => id !== "admins" || admin.role === "super_admin");
  const notifications = (data.activity as any[]).slice(0, 5);
  const selectTab = (next: Tab) => {
    setTab(next);
    setMobileNavOpen(false);
  };
  return (
    <div
      className={`admin-shell ${sidebarCollapsed ? "is-collapsed" : ""} ${mobileNavOpen ? "mobile-nav-open" : ""}`}
      data-theme={theme}
    >
      <div className="admin-mobile-backdrop" onClick={() => setMobileNavOpen(false)} />
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">
            <ShieldCheck size={22} />
          </span>
          <span className="admin-brand-copy">
            <strong>WallRush</strong>
            <small>Control center</small>
          </span>
          <button
            className="admin-sidebar-collapse"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <div className="admin-secure">
          <span className="admin-live-dot" /> <span>Private admin mode</span>
        </div>
        <nav className="admin-nav">
          {navGroups.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.ids.map((id) => {
                const item = visibleTabs.find((tabItem) => tabItem.id === id);
                if (!item) return null;
                const Icon = item.icon;
                return (
                  <button
                    key={id}
                    className={tab === id ? "active" : ""}
                    onClick={() => selectTab(id)}
                    title={item.label}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                    {id === "rooms" && stats["activeRooms"] ? <b>{stats["activeRooms"]}</b> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <div className="admin-identity">
            <CircleUserRound size={30} />
            <span>
              <strong>{admin.username}</strong>
              <small>
                {admin.role === "super_admin" ? "Super administrator" : "Administrator"}
              </small>
            </span>
          </div>
          <button
            className="admin-logout"
            onClick={() => {
              void adminApi.logout().finally(() => setAdmin(null));
            }}
          >
            <LogOut size={16} /> <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-title-block">
            <button
              className="admin-mobile-menu"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="admin-breadcrumb">
                <span>WallRush</span>
                <ChevronRight size={13} />
                <span>Administration</span>
                <ChevronRight size={13} />
                <strong>{tabs.find((item) => item.id === tab)?.label}</strong>
              </p>
              <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
              <p className="admin-topbar-subtitle">A calm, focused view of your game operations.</p>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <div className="admin-notification-wrap">
              <button
                className="admin-icon-button admin-notification"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((current) => !current)}
              >
                <Bell size={16} />
                {notifications.length > 0 && <span />}
              </button>
              {notificationsOpen && (
                <AdminNotifications
                  notifications={notifications}
                  onViewAll={() => {
                    setNotificationsOpen(false);
                    selectTab("activity");
                  }}
                />
              )}
            </div>
            <button
              className="admin-theme-toggle"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button className="admin-refresh" onClick={() => void load()} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />{" "}
              {refreshing ? "Refreshing" : "Refresh data"}
            </button>
          </div>
        </header>
        {tab === "overview" && (
          <>
            <OverviewHero stats={stats} />
            <Overview stats={stats} />
          </>
        )}
        {tab === "users" && <UsersPanel users={data.users} onReload={load} />}
        {tab === "matches" && <MatchesPanel matches={data.matches} />}
        {tab === "rooms" && <RoomsPanel rooms={data.rooms} />}
        {tab === "rankings" && <RankingsPanel users={data.users} />}
        {tab === "analytics" && <AnalyticsPanel data={data} />}
        {tab === "activity" && <ActivityPanel activity={data.activity} />}
        {tab === "links" && <SocialLinksPanel initialLinks={data.links} />}
        {tab === "admins" && <AdminsPanel admin={admin} onAdminChange={setAdmin} />}
      </main>
    </div>
  );
}

function AdminNotifications({ notifications, onViewAll }: { notifications: any[]; onViewAll: () => void }) {
  return (
    <section className="admin-notification-menu" aria-label="Recent notifications">
      <div className="admin-notification-head">
        <div>
          <strong>Notifications</strong>
          <small>Recent admin activity</small>
        </div>
        <Bell size={16} />
      </div>
      <div className="admin-notification-list">
        {notifications.length === 0 ? (
          <p className="admin-notification-empty">You are all caught up.</p>
        ) : (
          notifications.map((item) => (
            <div className="admin-notification-item" key={item.id}>
              <span className="admin-notification-dot" />
              <div>
                <strong>{String(item.action ?? "System activity").replaceAll("_", " ")}</strong>
                <small>{item.actor ?? "System"} · {date(item.created_at)}</small>
              </div>
            </div>
          ))
        )}
      </div>
      <button type="button" className="admin-notification-view" onClick={onViewAll}>
        View audit log <ChevronRight size={14} />
      </button>
    </section>
  );
}

function AdminLogin({
  onLogin,
  error,
  setError,
}: {
  onLogin: (admin: AdminIdentity) => void;
  error: string;
  setError: (value: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await adminApi.login(username, password);
      onLogin(result.admin);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-login-page">
      <div className="admin-login-glow" />
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-login-icon">
          <ShieldCheck size={30} />
        </div>
        <p className="admin-eyebrow">Restricted access</p>
        <h1>Admin command center</h1>
        <p className="admin-login-copy">
          Sign in with your private administrator credentials to continue.
        </p>
        <label>
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="admin-error">{error}</p>}
        <button className="admin-primary" disabled={busy}>
          {busy ? "Authenticating..." : "Enter dashboard"}
          <ChevronRight size={17} />
        </button>
        <small className="admin-login-note">Protected by server-side session authorization</small>
      </form>
    </div>
  );
}

function SocialLinksPanel({ initialLinks }: { initialLinks: SocialLink[] }) {
  const [links, setLinks] = useState<SocialLink[]>(initialLinks);
  const [newLink, setNewLink] = useState({ label: "", url: "", icon: "🔗" });
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => setLinks(initialLinks), [initialLinks]);
  function clearNotice() {
    setNotice("");
    setError("");
  }
  async function saveLink(link: SocialLink) {
    clearNotice();
    setSaving(link.id);
    try {
      const result = await adminApi.updateSocialLink(link.id, {
        label: link.label,
        url: link.url,
        icon: link.icon,
        enabled: link.enabled,
        position: link.position,
      });
      setLinks((current) => current.map((item) => (item.id === link.id ? result.link : item)));
      setNotice(`${link.label} was updated.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this link.");
    } finally {
      setSaving(null);
    }
  }
  async function createLink(event: React.FormEvent) {
    event.preventDefault();
    clearNotice();
    setSaving("new");
    try {
      const result = await adminApi.createSocialLink({
        ...newLink,
        enabled: true,
        position: links.length,
      });
      setLinks((current) => [...current, result.link]);
      setNewLink({ label: "", url: "", icon: "🔗" });
      setNotice(`${result.link.label} was added.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add this link.");
    } finally {
      setSaving(null);
    }
  }
  async function removeLink(link: SocialLink) {
    if (!window.confirm(`Remove ${link.label} from the website?`)) return;
    clearNotice();
    setSaving(link.id);
    try {
      await adminApi.deleteSocialLink(link.id);
      setLinks((current) => current.filter((item) => item.id !== link.id));
      setNotice(`${link.label} was removed.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove this link.");
    } finally {
      setSaving(null);
    }
  }
  return (
    <div className="admin-links-layout">
      <section className="admin-section admin-links-intro">
        <div className="admin-section-head">
          <div>
            <p className="admin-eyebrow">Public website</p>
            <h2>Social media / website links</h2>
          </div>
          <Link2 size={23} />
        </div>
        <p className="admin-panel-copy">
          Manage the community destinations shown in the public WallRush home page. Disabled links
          disappear immediately from visitors.
        </p>
        <form className="admin-link-create" onSubmit={createLink}>
          <div className="admin-link-create-head">
            <strong>Add a destination</strong>
            <span>HTTPS links only</span>
          </div>
          <div className="admin-form-grid">
            <label>
              Label
              <input
                value={newLink.label}
                onChange={(event) => setNewLink({ ...newLink, label: event.target.value })}
                placeholder="Discord"
                required
              />
            </label>
            <label>
              Icon
              <input
                value={newLink.icon}
                onChange={(event) => setNewLink({ ...newLink, icon: event.target.value })}
                maxLength={8}
                placeholder="💬"
              />
            </label>
            <label className="wide">
              URL
              <input
                type="url"
                value={newLink.url}
                onChange={(event) => setNewLink({ ...newLink, url: event.target.value })}
                placeholder="https://discord.com/..."
                required
              />
            </label>
          </div>
          <button className="admin-primary" disabled={saving === "new"}>
            <Plus size={16} /> {saving === "new" ? "Adding..." : "Add link"}
          </button>
        </form>
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <p className="admin-eyebrow">Live configuration</p>
            <h2>Published destinations</h2>
          </div>
          <span className="admin-count">{links.length} links</span>
        </div>
        {notice && (
          <p className="admin-success">
            <Check size={15} /> {notice}
          </p>
        )}
        {error && <p className="admin-error">{error}</p>}
        <div className="admin-links-list">
          {links.length === 0 && <div className="admin-empty">No destinations configured yet.</div>}
          {links.map((link) => (
            <div className={`admin-link-row ${link.enabled ? "" : "is-disabled"}`} key={link.id}>
              <div className="admin-link-icon">{link.icon}</div>
              <div className="admin-link-fields">
                <input
                  aria-label={`${link.label} label`}
                  value={link.label}
                  onChange={(event) =>
                    setLinks((current) =>
                      current.map((item) =>
                        item.id === link.id ? { ...item, label: event.target.value } : item,
                      ),
                    )
                  }
                />
                <input
                  aria-label={`${link.label} URL`}
                  value={link.url}
                  onChange={(event) =>
                    setLinks((current) =>
                      current.map((item) =>
                        item.id === link.id ? { ...item, url: event.target.value } : item,
                      ),
                    )
                  }
                />
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${link.label}`}
                >
                  <ExternalLink size={15} />
                </a>
              </div>
              <label className="admin-link-enabled">
                <input
                  type="checkbox"
                  checked={link.enabled}
                  onChange={(event) =>
                    setLinks((current) =>
                      current.map((item) =>
                        item.id === link.id ? { ...item, enabled: event.target.checked } : item,
                      ),
                    )
                  }
                />{" "}
                <span>{link.enabled ? "Visible" : "Hidden"}</span>
              </label>
              <button
                className="admin-secondary admin-link-save"
                onClick={() => void saveLink(link)}
                disabled={saving === link.id}
              >
                {saving === link.id ? "Saving" : "Save"}
              </button>
              <button
                className="admin-icon-button admin-link-delete"
                onClick={() => void removeLink(link)}
                disabled={saving === link.id}
                aria-label={`Remove ${link.label}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminsPanel({
  admin,
  onAdminChange,
}: {
  admin: AdminIdentity;
  onAdminChange: (admin: AdminIdentity) => void;
}) {
  const [profileName, setProfileName] = useState(admin.username);
  const [profilePassword, setProfilePassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [passwordAdmin, setPasswordAdmin] = useState<AdminAccount | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    adminApi
      .admins()
      .then((result) => setAdmins(result.admins))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Could not load administrators."),
      );
  }, []);
  function clearNotice() {
    setMessage("");
    setError("");
  }
  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    clearNotice();
    setSaving(true);
    try {
      const result = await adminApi.updateProfile(profileName, profilePassword);
      onAdminChange(result.admin);
      setProfilePassword("");
      setMessage("Your administrator profile was updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update your profile.");
    } finally {
      setSaving(false);
    }
  }
  async function createAdmin(event: React.FormEvent) {
    event.preventDefault();
    clearNotice();
    setSaving(true);
    try {
      const result = await adminApi.createAdmin(newName, newPassword);
      setAdmins((current) => [...current, result.admin]);
      setNewName("");
      setNewPassword("");
      setShowCreate(false);
      setMessage("The new administrator account was created.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the administrator.");
    } finally {
      setSaving(false);
    }
  }
  async function deleteAdmin(account: AdminAccount) {
    clearNotice();
    if (!window.confirm(`Delete administrator ${account.username}?`)) return;
    setSaving(true);
    try {
      await adminApi.deleteAdmin(account.id);
      setAdmins((current) => current.filter((item) => item.id !== account.id));
      setMessage(`${account.username} was removed.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the administrator.");
    } finally {
      setSaving(false);
    }
  }
  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordAdmin) return;
    clearNotice();
    setSaving(true);
    try {
      await adminApi.updateAdminPassword(passwordAdmin.id, newPassword);
      setNewPassword("");
      setPasswordAdmin(null);
      setMessage(`${passwordAdmin.username}'s password was updated.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the password.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="admin-admin-grid">
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <p className="admin-eyebrow">Your access</p>
            <h2>Edit your profile</h2>
          </div>
          <CircleUserRound size={24} />
        </div>
        <form onSubmit={saveProfile} className="admin-form-grid">
          <label className="wide">
            Username
            <input
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="wide">
            New password
            <input
              type="password"
              value={profilePassword}
              onChange={(event) => setProfilePassword(event.target.value)}
              placeholder="Leave blank to keep current"
              autoComplete="new-password"
            />
          </label>
          <div className="admin-drawer-actions wide">
            <button className="admin-primary" disabled={saving}>
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </section>
      <section className="admin-section admin-admin-list">
        <div className="admin-section-head">
          <div>
            <p className="admin-eyebrow">Access control</p>
            <h2>Manage administrators</h2>
          </div>
          <button
            className="admin-primary"
            onClick={() => {
              clearNotice();
              setShowCreate(true);
            }}
          >
            <Plus size={16} /> New admin
          </button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {admins.map((account) => (
                <tr key={account.id}>
                  <td>
                    <strong>{account.username}</strong>
                    {account.id === admin.id && <span className="admin-badge blue">You</span>}
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${account.role === "super_admin" ? "purple" : "blue"}`}
                    >
                      {account.role === "super_admin" ? "Super admin" : "Admin"}
                    </span>
                  </td>
                  <td>{date(account.created_at)}</td>
                  <td>
                    <button
                      className="admin-icon-button"
                      title={`Change ${account.username} password`}
                      onClick={() => {
                        clearNotice();
                        setNewPassword("");
                        setPasswordAdmin(account);
                      }}
                      disabled={saving}
                    >
                      <KeyRound size={16} />
                    </button>
                    {account.id !== admin.id && (
                      <button
                        className="admin-icon-button"
                        title={`Delete ${account.username}`}
                        onClick={() => void deleteAdmin(account)}
                        disabled={saving}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {(message || error) && (
        <p className={error ? "admin-error" : "admin-success"}>{error || message}</p>
      )}
      {showCreate && (
        <div className="admin-modal-backdrop" onClick={() => setShowCreate(false)}>
          <section className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-drawer-head">
              <div>
                <p className="admin-eyebrow">Access control</p>
                <h2>Create administrator</h2>
              </div>
              <button className="admin-icon-button" onClick={() => setShowCreate(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={createAdmin} className="admin-form-grid">
              <label className="wide">
                Username
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
              <label className="wide">
                Password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </label>
              <div className="admin-drawer-actions wide">
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button className="admin-primary" disabled={saving}>
                  {saving ? "Creating..." : "Create administrator"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {passwordAdmin && (
        <div className="admin-modal-backdrop" onClick={() => setPasswordAdmin(null)}>
          <section className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-drawer-head">
              <div>
                <p className="admin-eyebrow">Access control</p>
                <h2>Change password</h2>
              </div>
              <button className="admin-icon-button" onClick={() => setPasswordAdmin(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={updatePassword} className="admin-form-grid">
              <p className="admin-modal-copy wide">
                Set a new password for {passwordAdmin.username}.
              </p>
              <label className="wide">
                New password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </label>
              <div className="admin-drawer-actions wide">
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={() => setPasswordAdmin(null)}
                >
                  Cancel
                </button>
                <button className="admin-primary" disabled={saving}>
                  {saving ? "Updating..." : "Update password"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function OverviewHero({ stats }: { stats: Record<string, number> }) {
  return (
    <section className="admin-overview-hero">
      <div>
        <p className="admin-eyebrow">Live operations</p>
        <h2>Good to see you, operator.</h2>
        <p>Monitor the player community, live rooms, and the systems that keep WallRush moving.</p>
      </div>
      <div className="admin-hero-rail">
        <div>
          <span>Active rooms</span>
          <strong>{number.format(stats["activeRooms"] ?? 0)}</strong>
        </div>
        <div>
          <span>Online now</span>
          <strong>{number.format(stats["online"] ?? 0)}</strong>
        </div>
        <div>
          <span>Today&apos;s visitors</span>
          <strong>{number.format(stats["visitorsToday"] ?? 0)}</strong>
        </div>
      </div>
    </section>
  );
}

function Overview({ stats }: { stats: Record<string, number> }) {
  const cards = [
    { label: "Registered users", key: "users", icon: Users, tone: "blue" },
    { label: "Online now", key: "online", icon: Activity, tone: "green" },
    { label: "Total matches", key: "matches", icon: Swords, tone: "orange" },
    { label: "Points distributed", key: "points", icon: Trophy, tone: "purple" },
  ];
  const secondary = [
    { label: "Visitors today", key: "visitorsToday" },
    { label: "Visitors this week", key: "visitorsWeek" },
    { label: "Visitors this month", key: "visitorsMonth" },
    { label: "Total visitors", key: "visitors" },
    { label: "Active rooms", key: "activeRooms" },
    { label: "Waiting rooms", key: "waitingRooms" },
    { label: "Real-player matches", key: "realMatches" },
    { label: "Bot matches", key: "botMatches" },
    { label: "New users today", key: "newToday" },
    { label: "New users this week", key: "newWeek" },
    { label: "New users this month", key: "newMonth" },
    { label: "Completed matches", key: "matches" },
  ];
  return (
    <>
      <section className="admin-kpi-grid">
        {cards.map(({ label, key, icon: Icon, tone }) => (
          <div className={`admin-kpi ${tone}`} key={key}>
            <span className="admin-kpi-icon">
              <Icon size={20} />
            </span>
            <small>{label}</small>
            <strong>{number.format(stats[key] ?? 0)}</strong>
            <span className="admin-kpi-caption">Live Neon data</span>
          </div>
        ))}
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <p className="admin-eyebrow">System pulse</p>
            <h2>Operational snapshot</h2>
          </div>
          <span className="admin-status-pill">
            <span className="admin-live-dot" /> Live
          </span>
        </div>
        <div className="admin-stat-grid">
          {secondary.map(({ label, key }) => (
            <div className="admin-stat" key={key}>
              <span>{label}</span>
              <strong>{number.format(stats[key] ?? 0)}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="admin-insight-grid">
        <div className="admin-insight">
          <Bot size={20} />
          <div>
            <strong>Bot matches stay unranked</strong>
            <p>AI opponents are tracked separately and never change human leaderboards.</p>
          </div>
        </div>
        <div className="admin-insight">
          <UserRoundCog size={20} />
          <div>
            <strong>Protected operations</strong>
            <p>Every account change is authorized server-side and written to the audit log.</p>
          </div>
        </div>
      </section>
    </>
  );
}

function UsersPanel({ users, onReload }: { users: AdminUser[]; onReload: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const visible = useMemo(
    () =>
      users.filter((user) =>
        `${user.username} ${user.email}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [users, query],
  );
  async function save(changes: Record<string, unknown>) {
    if (!selected) return;
    setSaving(true);
    try {
      await adminApi.updateUser(selected.id, changes);
      await onReload();
      const refreshed = await adminApi.user(selected.id);
      setSelected(refreshed.user);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <div>
          <p className="admin-eyebrow">Directory</p>
          <h2>User management</h2>
        </div>
        <span className="admin-count">{visible.length} users</span>
      </div>
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={17} />
          <input
            placeholder="Search by username or email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Points</th>
              <th>Record</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.username}</strong>
                  <small>{user.email}</small>
                </td>
                <td>
                  <span className={`admin-badge ${user.disabled ? "red" : "green"}`}>
                    {user.disabled ? "Disabled" : "Active"}
                  </span>
                </td>
                <td>{number.format(user.points)}</td>
                <td>
                  {user.wins}W / {user.losses}L
                </td>
                <td>{date(user.created_at)}</td>
                <td>
                  <button className="admin-icon-button" onClick={() => setSelected(user)}>
                    <ChevronRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <UserDrawer
          user={selected}
          onClose={() => setSelected(null)}
          onSave={save}
          saving={saving}
        />
      )}
    </div>
  );
}

function UserDrawer({
  user,
  onClose,
  onSave,
  saving,
}: {
  user: AdminUser;
  onClose: () => void;
  onSave: (changes: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  const [username, setUsername] = useState(user.username);
  const [points, setPoints] = useState(String(user.points));
  const [wins, setWins] = useState(String(user.wins));
  const [losses, setLosses] = useState(String(user.losses));
  const [disabled, setDisabled] = useState(user.disabled);
  const [password, setPassword] = useState("");
  return (
    <div className="admin-drawer-backdrop" onClick={onClose}>
      <aside className="admin-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="admin-drawer-head">
          <div>
            <p className="admin-eyebrow">User profile</p>
            <h2>{user.username}</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="admin-profile-summary">
          <CircleUserRound size={38} />
          <div>
            <strong>{user.email}</strong>
            <span>
              Rank #{user.rank ?? "-"} · {user.match_count ?? user.games} matches
            </span>
          </div>
        </div>
        <div className="admin-form-grid">
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            Points
            <input
              type="number"
              value={points}
              onChange={(event) => setPoints(event.target.value)}
            />
          </label>
          <label>
            Wins
            <input type="number" value={wins} onChange={(event) => setWins(event.target.value)} />
          </label>
          <label>
            Losses
            <input
              type="number"
              value={losses}
              onChange={(event) => setLosses(event.target.value)}
            />
          </label>
          <label className="wide">
            Reset password
            <input
              type="password"
              placeholder="Leave blank to keep current"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        </div>
        <label className="admin-toggle">
          <input
            type="checkbox"
            checked={disabled}
            onChange={(event) => setDisabled(event.target.checked)}
          />{" "}
          Disable account
        </label>
        <div className="admin-drawer-actions">
          <button className="admin-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="admin-primary"
            disabled={saving}
            onClick={() =>
              void onSave({
                username,
                points: Number(points),
                wins: Number(wins),
                losses: Number(losses),
                disabled,
                ...(password ? { password } : {}),
              })
            }
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function MatchesPanel({ matches }: { matches: any[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <>
      <TableSection
        eyebrow="Game operations"
        title="Match records"
        count={`${matches.length} records`}
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Player</th>
              <th>Opponent</th>
              <th>Status</th>
              <th>Result</th>
              <th>Recorded</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={match.id}>
                <td>
                  <code>{String(match.id).slice(0, 8)}</code>
                  {match.record_type === "room" && <small>Live room {match.room_code}</small>}
                </td>
                <td>
                  <strong>{match.username}</strong>
                </td>
                <td>
                  <span className="admin-badge blue">
                    {match.opponent_type === "ai"
                      ? "AI bot"
                      : match.opponent_type === "live"
                        ? "Live match"
                        : "Real player"}
                  </span>
                  <small>{match.opponent_name ?? "-"}</small>
                </td>
                <td>
                  <StatusBadge status={match.status ?? (match.result ? "completed" : "unknown")} />
                </td>
                <td>
                  {match.result ? (
                    <span className={`admin-badge ${match.result === "win" ? "green" : "red"}`}>
                      {match.result}
                    </span>
                  ) : (
                    <span className="admin-muted">In progress</span>
                  )}
                </td>
                <td>{date(match.created_at)}</td>
                <td>
                  <button
                    className="admin-secondary admin-view-button"
                    onClick={() => setSelectedId(String(match.id))}
                  >
                    View <ChevronRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableSection>
      {selectedId && <MatchDetailModal id={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized === "live" || normalized === "playing"
      ? "green"
      : normalized === "waiting"
        ? "orange"
        : normalized === "resigned"
          ? "red"
          : normalized === "completed" || normalized === "done"
            ? "blue"
            : "purple";
  return (
    <span className={`admin-badge ${tone}`}>
      {normalized === "playing" ? "Live" : normalized.charAt(0).toUpperCase() + normalized.slice(1)}
    </span>
  );
}

function MatchDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<{ match: any | null; room: any | null } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const load = () =>
      adminApi
        .match(id)
        .then((next) => {
          if (alive) {
            setDetail(next);
            setError("");
          }
        })
        .catch((caught) => {
          if (alive)
            setError(caught instanceof Error ? caught.message : "Could not load this match.");
        });
    void load();
    const timer = window.setInterval(() => {
      if (detail?.room?.status === "playing" || detail?.room?.status === "waiting") void load();
    }, 2000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [id, detail?.room?.status]);
  const room = detail?.room;
  const match = detail?.match;
  const game = room?.state?.game;
  const resignedBy = room?.state?.resignedBy;
  const winner = room?.winner === 0 ? room?.p1_name : room?.winner === 1 ? room?.p2_name : null;
  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <section className="admin-match-modal" onClick={(event) => event.stopPropagation()}>
        <header className="admin-match-modal-head">
          <div>
            <p className="admin-eyebrow">Match detail</p>
            <h2>{room?.code ? `Room ${room.code}` : `Match ${String(id).slice(0, 8)}`}</h2>
            <p>
              {room?.status === "playing"
                ? "Live match · updates every 2 seconds"
                : "Authoritative match record"}
            </p>
          </div>
          <button className="admin-icon-button" onClick={onClose} aria-label="Close match detail">
            <X size={18} />
          </button>
        </header>
        {error && <p className="admin-error">{error}</p>}
        {!detail && !error && <div className="admin-detail-loading">Loading match detail...</div>}
        {detail && (
          <>
            <div className="admin-match-summary">
              <div>
                <span>Status</span>
                <strong>
                  <StatusBadge
                    status={
                      room?.status === "playing"
                        ? "live"
                        : room?.status === "waiting"
                          ? "waiting"
                          : resignedBy !== undefined && resignedBy !== null
                            ? "resigned"
                            : (match?.status ?? "completed")
                    }
                  />
                </strong>
              </div>
              <div>
                <span>Player 1</span>
                <strong>{room?.p1_name ?? match?.username ?? "Unknown"}</strong>
              </div>
              <div>
                <span>Player 2</span>
                <strong>{room?.p2_name ?? match?.opponent_name ?? "Unknown"}</strong>
              </div>
              <div>
                <span>Winner</span>
                <strong>
                  {winner ??
                    (match?.result === "win"
                      ? match.username
                      : match?.result === "loss"
                        ? match.opponent_name
                        : "-")}
                </strong>
              </div>
            </div>
            <div className="admin-detail-grid">
              <section className="admin-detail-card">
                <div className="admin-detail-card-head">
                  <h3>Game state</h3>
                  {game && <span className="admin-count">Move {game.moveCount}</span>}
                </div>
                {game ? (
                  <Board
                    state={game}
                    me={0}
                    interactive={false}
                    mode="move"
                    orient="h"
                    onMove={() => {}}
                    onWall={() => {}}
                  />
                ) : (
                  <div className="admin-empty">No board state is stored for this record.</div>
                )}
              </section>
              <section className="admin-detail-card">
                <h3>Timeline & result</h3>
                <dl className="admin-detail-list">
                  <div>
                    <dt>Created</dt>
                    <dd>{date(room?.created_at ?? match?.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Last updated</dt>
                    <dd>{date(room?.updated_at ?? match?.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Current turn</dt>
                    <dd>
                      {game
                        ? game.turn === 0
                          ? (room?.p1_name ?? "Player 1")
                          : (room?.p2_name ?? "Player 2")
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt>Resigned by</dt>
                    <dd>
                      {resignedBy === 0
                        ? room?.p1_name
                        : resignedBy === 1
                          ? room?.p2_name
                          : "No resignation recorded"}
                    </dd>
                  </div>
                  <div>
                    <dt>Resignation time</dt>
                    <dd>
                      {date(
                        room?.state?.resignedAt
                          ? new Date(room.state.resignedAt).toISOString()
                          : null,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Move history</dt>
                    <dd>
                      {game?.history?.length ? game.history.join(" · ") : "No moves recorded"}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
function RoomsPanel({ rooms }: { rooms: any[] }) {
  return (
    <TableSection eyebrow="Live operations" title="Room monitor" count={`${rooms.length} rooms`}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Room</th>
            <th>Players</th>
            <th>Mode</th>
            <th>Status</th>
            <th>Last activity</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id}>
              <td>
                <strong>{room.code}</strong>
              </td>
              <td>
                {room.p1_name ?? "-"} <span className="admin-muted">vs</span>{" "}
                {room.p2_name ?? "Waiting"}
              </td>
              <td>
                {room.is_bot ? (
                  <span className="admin-badge purple">Bot match</span>
                ) : (
                  <span className="admin-badge blue">Human</span>
                )}
              </td>
              <td>
                <span className={`admin-badge ${room.status === "playing" ? "green" : "orange"}`}>
                  {room.status}
                </span>
              </td>
              <td>{date(room.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableSection>
  );
}
function RankingsPanel({ users }: { users: AdminUser[] }) {
  return (
    <TableSection
      eyebrow="Leaderboard"
      title="Ranking management"
      count={`${users.length} ranked users`}
    >
      <table className="admin-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Username</th>
            <th>Points</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Win rate</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {[...users]
            .sort((a, b) => b.points - a.points)
            .map((user, index) => (
              <tr key={user.id}>
                <td>
                  <strong>#{index + 1}</strong>
                </td>
                <td>{user.username}</td>
                <td>{number.format(user.points)}</td>
                <td>{user.wins}</td>
                <td>{user.losses}</td>
                <td>{user.games ? `${Math.round((user.wins / user.games) * 100)}%` : "0%"}</td>
                <td>{user.disabled ? "Disabled" : "Active"}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </TableSection>
  );
}
function AnalyticsPanel({ data }: { data: any }) {
  const growth = data.growth.map((item: any) => ({
    day: String(item.day).slice(5),
    users: item.count,
  }));
  const visits = data.visits.map((item: any) => ({
    day: String(item.day).slice(5),
    visitors: item.count,
  }));
  const matches = data.dailyMatches.map((item: any) => ({
    day: String(item.day).slice(5),
    matches: item.count,
  }));
  return (
    <div className="admin-chart-grid">
      <Chart title="User growth" data={growth} keys={["users"]} colors={["#58a6ff"]} />
      <Chart title="Daily visitors" data={visits} keys={["visitors"]} colors={["#51d88a"]} />
      <Chart title="Matches per day" data={matches} keys={["matches"]} colors={["#ffb454"]} />
      <div className="admin-chart-card">
        <h3>Match composition</h3>
        <ResponsiveContainer width="100%" height={235}>
          <BarChart data={data.split}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26364b" />
            <XAxis dataKey="type" stroke="#8da0b8" />
            <YAxis stroke="#8da0b8" />
            <Tooltip />
            <Bar dataKey="count" fill="#a78bfa" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
function Chart({
  title,
  data,
  keys,
  colors,
}: {
  title: string;
  data: any[];
  keys: string[];
  colors: string[];
}) {
  return (
    <div className="admin-chart-card">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={235}>
        <AreaChart data={data}>
          <defs>
            {keys.map((key, index) => (
              <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[index]} stopOpacity={0.35} />
                <stop offset="95%" stopColor={colors[index]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#26364b" />
          <XAxis dataKey="day" stroke="#8da0b8" />
          <YAxis stroke="#8da0b8" allowDecimals={false} />
          <Tooltip />
          <Legend />
          {keys.map((key, index) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[index]}
              fill={`url(#gradient-${key})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
function ActivityPanel({ activity }: { activity: any[] }) {
  return (
    <TableSection
      eyebrow="Security trail"
      title="Admin activity log"
      count={`${activity.length} events`}
    >
      <table className="admin-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Actor</th>
            <th>Target</th>
            <th>Details</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {activity.map((item) => (
            <tr key={item.id}>
              <td>
                <span className="admin-badge blue">{item.action}</span>
              </td>
              <td>{item.actor}</td>
              <td>
                <code>{item.target_id ? String(item.target_id).slice(0, 8) : "-"}</code>
              </td>
              <td className="admin-muted">{JSON.stringify(item.details)}</td>
              <td>{date(item.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableSection>
  );
}
function TableSection({
  eyebrow,
  title,
  count,
  children,
}: {
  eyebrow: string;
  title: string;
  count: string;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <p className="admin-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span className="admin-count">{count}</span>
      </div>
      <div className="admin-table-wrap">{children}</div>
    </section>
  );
}
