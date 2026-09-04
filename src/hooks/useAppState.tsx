import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadLocal, saveLocal, todayKey, type LocalData, type Settings } from "@/lib/local";
import { api, type ApiUser } from "@/lib/api";

export type Profile = ApiUser;
export type User = Pick<ApiUser, "id" | "email">;
export type Session = { user: User };

interface Ctx {
  ready: boolean;
  local: LocalData;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  displayName: string;
  points: number;
  stats: { games: number; wins: number; losses: number; streak: number };
  daily: { count: number; goal: number };
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  setName: (n: string) => void;
  recordResult: (won: boolean, opts: { opponentType: string; opponentName?: string; ranked: boolean }) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);
const DAILY_GOAL = 4;

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [local, setLocal] = useState<LocalData>(() => loadLocal());
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    setLocal(loadLocal());
    const syncSession = () => {
      api.session().then(({ user }) => setSession(user ? { user: { id: user.id, email: user.email } } : null)).catch(() => setSession(null)).finally(() => setReady(true));
    };
    syncSession();
    window.addEventListener("pageshow", syncSession);
    return () => window.removeEventListener("pageshow", syncSession);
  }, []);

  const loadProfile = useCallback(async (uid: string) => {
    const current = await api.session();
    if (current.user?.id === uid) setProfile(current.user);
  }, []);

  useEffect(() => {
    if (session?.user) void loadProfile(session.user.id);
    else setProfile(null);
  }, [session, loadProfile]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", local.settings.dark);
  }, [local.settings.dark]);

  const update = useCallback((patch: Partial<LocalData>) => {
    setLocal((prev) => {
      const next = { ...prev, ...patch };
      saveLocal(next);
      return next;
    });
  }, []);

  const setSettings = useCallback(
    (s: Partial<Settings>) => {
      setLocal((prev) => {
        const next = { ...prev, settings: { ...prev.settings, ...s } };
        saveLocal(next);
        return next;
      });
    },
    [],
  );

  const setName = useCallback(
    (n: string) => {
      update({ name: n });
      if (session?.user) void api.updateProfile(n).then(({ user }) => setProfile(user)).catch(() => {});
    },
    [update, session],
  );

  const recordResult = useCallback(
    async (won: boolean, opts: { opponentType: string; opponentName?: string; ranked: boolean }) => {
      const gained = won ? (opts.ranked ? 25 : 8) : opts.ranked ? -8 : 0;
      const today = todayKey();

      setLocal((prev) => {
        const st = prev.stats;
        const sameDay = st.dailyDate === today;
        const streak = st.lastPlayed === today ? st.streak : st.streak + 1;
        const next: LocalData = {
          ...prev,
          stats: {
            ...st,
            points: Math.max(0, st.points + gained),
            games: st.games + (opts.ranked ? 1 : 0),
            wins: st.wins + (won && opts.ranked ? 1 : 0),
            losses: st.losses + (!won && opts.ranked ? 1 : 0),
            streak,
            lastPlayed: today,
            dailyDate: today,
            dailyCount: (sameDay ? st.dailyCount : 0) + 1,
          },
        };
        saveLocal(next);
        return next;
      });

      const uid = session?.user?.id;
      if (uid) {
        await api.recordMatch({ opponentType: opts.opponentType, opponentName: opts.opponentName, result: won ? "win" : "loss", points: gained, ranked: opts.ranked });
        await loadProfile(uid);
      }
    },
    [session, loadProfile],
  );

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setSession(null);
      setProfile(null);
    }
  }, []);

  const value = useMemo<Ctx>(() => {
    const displayName = profile?.username ?? local.name;
    return {
      ready,
      local,
      user: session?.user ?? null,
      session,
      profile,
      displayName,
      points: profile?.points ?? local.stats.points,
      stats: profile
        ? { games: profile.games, wins: profile.wins, losses: profile.losses, streak: profile.streak }
        : {
            games: local.stats.games,
            wins: local.stats.wins,
            losses: local.stats.losses,
            streak: local.stats.streak,
          },
      daily: {
        count: local.stats.dailyDate === todayKey() ? local.stats.dailyCount : 0,
        goal: DAILY_GOAL,
      },
      settings: local.settings,
      setSettings,
      setName,
      recordResult,
      refreshProfile,
      signOut,
    };
  }, [ready, local, session, profile, setSettings, setName, recordResult, refreshProfile, signOut]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside AppStateProvider");
  return ctx;
}
