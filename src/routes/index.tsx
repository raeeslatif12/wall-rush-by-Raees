import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import { useApp } from "@/hooks/useAppState";
import { createRoom, joinRoom, onlineCount, quickMatch } from "@/lib/rooms";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WallRush — play Quoridor online free, 1v1" },
      {
        name: "description",
        content:
          "WallRush is a free 1v1 Quoridor game in your browser. Quick match, public rooms, play a friend by code, or beat the AI. No download, no signup.",
      },
      { property: "og:title", content: "WallRush — play Quoridor online free, 1v1" },
      {
        property: "og:description",
        content: "Race your pawn across the 9x9 board and use ten walls to make your opponent's path longer.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const app = useApp();
  const navigate = useNavigate();
  const [online, setOnline] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => onlineCount().then((n) => alive && setOnline(n)).catch(() => {});
    tick();
    const t = setInterval(tick, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  async function go(kind: "quick" | "create-public" | "create-private") {
    setError(null);
    setBusy(kind);
    try {
      const room =
        kind === "quick"
          ? await quickMatch(app.local.token, app.displayName)
          : await createRoom({
              isPublic: kind === "create-public",
              token: app.local.token,
              name: app.displayName,
            });
      navigate({ to: "/room/$code", params: { code: room.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function join() {
    setError(null);
    if (code.trim().length < 4) {
      setError("Enter the 6-character code.");
      return;
    }
    setBusy("join");
    try {
      const room = await joinRoom(code.trim().toUpperCase(), app.local.token, app.displayName);
      navigate({ to: "/room/$code", params: { code: room.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
    } finally {
      setBusy(null);
    }
  }

  const pct = Math.min(100, (app.daily.count / app.daily.goal) * 100);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-md px-4 pt-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-2xl text-primary-foreground shadow-[var(--shadow-raised)]">
              🧱
            </span>
            <h1 className="text-4xl font-black tracking-tight">WallRush</h1>
          </div>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Block their way
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-sm shadow-[var(--shadow-card)]">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="font-bold">{online ?? "—"}</span>
            <span className="text-muted-foreground">online</span>
          </div>
        </div>

        <div className="card-surface mt-6 flex items-center gap-3 p-4">
          <span className="text-2xl">🎯</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Play {app.daily.goal} matches today</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">
              {app.daily.count}/{app.daily.goal}
            </p>
            <p className="text-xs font-bold text-success">+25</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => go("quick")}
          disabled={busy !== null}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-primary p-4 text-left text-primary-foreground shadow-[var(--shadow-raised)] disabled:opacity-60"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-foreground/15 text-xl">⚡</span>
          <span className="flex-1">
            <span className="block text-lg font-extrabold">Quick match</span>
            <span className="block text-sm opacity-80">
              {busy === "quick" ? "Looking for an opponent…" : "Find opponent"}
            </span>
          </span>
          <span className="text-xl opacity-70">›</span>
        </button>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <Link
            to="/online"
            className="rounded-2xl bg-primary p-4 text-primary-foreground shadow-[var(--shadow-raised)]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-foreground/15 text-lg">🌐</span>
            <span className="mt-6 block text-lg font-extrabold leading-tight">Play online</span>
            <span className="block text-sm opacity-80">Public rooms</span>
          </Link>
          <Link
            to="/friend"
            className="rounded-2xl bg-accent p-4 text-accent-foreground shadow-[var(--shadow-raised)]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-foreground/15 text-lg">🤝</span>
            <span className="mt-6 block text-lg font-extrabold leading-tight">Play with friend</span>
            <span className="block text-sm opacity-80">Via code</span>
          </Link>
        </div>

        <Row to="/ai" emoji="🤖" title="Vs AI" subtitle="Practice" />
        <Row to="/rules" emoji="📖" title="How to play" />

        <div className="mt-4 flex flex-col gap-2">
          <div className="card-surface p-4">
            <p className="text-sm font-bold">Play with a friend right now</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => go("create-private")}
                disabled={busy !== null}
                className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                Create room with code
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter friend's code"
                maxLength={6}
                className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-bold tracking-widest outline-none focus:border-ring"
              />
              <button
                type="button"
                onClick={join}
                disabled={busy !== null}
                className="rounded-xl bg-muted px-4 py-2.5 text-sm font-bold disabled:opacity-60"
              >
                Join
              </button>
            </div>
            {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <Link
            to="/support"
            className="rounded-2xl bg-warning/25 px-4 py-3 text-center text-sm font-extrabold text-foreground"
          >
            💛 Support
          </Link>
          <Link
            to="/advertise"
            className="rounded-2xl bg-primary-soft px-4 py-3 text-center text-sm font-extrabold text-primary"
          >
            📣 Advertise
          </Link>
        </div>

        <p className="mt-8 text-center text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Follow us
        </p>
        <div className="mt-3 flex justify-center gap-3">
          {[
            { href: "https://www.instagram.com/wall_rush_", label: "Instagram", icon: "📸" },
            { href: "https://www.tiktok.com/@wall_rush_", label: "TikTok", icon: "🎵" },
            { href: "https://t.me/wall_rush1", label: "Telegram", icon: "✈️" },
            { href: "https://www.youtube.com/@wall_rush", label: "YouTube", icon: "▶️" },
          ].map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              aria-label={s.label}
              className="card-surface grid h-12 w-12 place-items-center text-xl"
            >
              {s.icon}
            </a>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-3 text-xs font-semibold text-muted-foreground">
          <Link to="/rules">Rules</Link>
          <span>·</span>
          <Link to="/reviews">Reviews</Link>
          <span>·</span>
          <Link to="/ranking">Ranking</Link>
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-extrabold">What is WallRush?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            WallRush is a free 1v1 strategy game you play straight in the browser — the classic Quoridor, online.
            Get your pawn to the far side of the 9×9 board before your opponent does, and use your ten walls to make
            their path longer. A wall cannot be jumped, only walked around, and you may never block someone off
            completely. Play against real people, against a friend by room code, or against the AI. No download and
            no signup.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function Row({
  to,
  emoji,
  title,
  subtitle,
}: {
  to: "/ai" | "/rules";
  emoji: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <Link to={to} className="card-surface mt-4 flex items-center gap-3 p-4">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-xl">{emoji}</span>
      <span className="flex-1">
        <span className="block text-lg font-extrabold leading-tight">{title}</span>
        {subtitle && <span className="block text-sm text-muted-foreground">{subtitle}</span>}
      </span>
      <span className="text-xl text-muted-foreground">›</span>
    </Link>
  );
}
