import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import AppShell, { PageHeader } from "@/components/AppShell";
import { useApp } from "@/hooks/useAppState";
import { rankFor } from "@/lib/local";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — WallRush stats and settings" },
      {
        name: "description",
        content: "Your WallRush profile: points, rank, win rate, daily streak, plus sound, vibration and theme settings.",
      },
      { property: "og:title", content: "Your WallRush profile" },
      { property: "og:description", content: "Track your points, rank, wins and streak." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const app = useApp();
  const navigate = useNavigate();
  const [name, setNameInput] = useState(app.displayName);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void app.refreshProfile();
  }, [app.user?.id, app.refreshProfile]);

  const { current, next } = rankFor(app.points);
  const progress = next ? Math.min(100, ((app.points - current.at) / (next.at - current.at)) * 100) : 100;

  return (
    <AppShell>
      <PageHeader title="Profile" subtitle={app.user ? app.user.email ?? "Signed in" : "Playing as guest"} />
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-8">
        <div className="card-surface p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-2xl">🏅</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-extrabold">{app.displayName}</p>
              <p className="text-sm text-muted-foreground">
                {current.name} · {app.points} pts
              </p>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {next ? `${next.at - app.points} points to ${next.name}` : "Top rank reached"}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Stat label="Games" value={app.stats.games} />
          <Stat label="Wins" value={app.stats.wins} />
          <Stat label="Losses" value={app.stats.losses} />
          <Stat label="Streak" value={app.stats.streak} />
        </div>

        <div className="card-surface p-4">
          <p className="text-sm font-bold">Display name</p>
          <div className="mt-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={18}
              className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:border-ring"
            />
            <button
              type="button"
              onClick={() => {
                app.setName(name.trim() || app.displayName);
                setSaved(true);
                setTimeout(() => setSaved(false), 1500);
              }}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
            >
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        <div className="card-surface divide-y divide-border">
          <Toggle label="Sound" on={app.settings.sound} onChange={(v) => app.setSettings({ sound: v })} />
          <Toggle
            label="Vibration"
            on={app.settings.vibration}
            onChange={(v) => app.setSettings({ vibration: v })}
          />
          <Toggle label="Dark mode" on={app.settings.dark} onChange={(v) => app.setSettings({ dark: v })} />
        </div>

        {app.user ? (
          <button
            type="button"
            onClick={() => void app.signOut().then(() => navigate({ to: "/" }))}
            className="w-full rounded-xl bg-muted px-4 py-3 text-sm font-extrabold"
          >
            Sign out
          </button>
        ) : (
          <Link
            to="/auth"
            className="block rounded-xl bg-primary px-4 py-3 text-center text-sm font-extrabold text-primary-foreground"
          >
            Sign in to save progress
          </Link>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-surface p-3 text-center">
      <p className="text-lg font-black">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className="flex w-full items-center justify-between px-4 py-3.5 text-left"
    >
      <span className="text-sm font-bold">{label}</span>
      <span
        className={`h-6 w-11 rounded-full border p-0.5 transition-colors ${on ? "border-primary bg-primary" : "border-input bg-muted"}`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-card shadow-sm transition-transform ${on ? "translate-x-5" : ""}`}
        />
      </span>
    </button>
  );
}
