import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import AppShell, { PageHeader } from "@/components/AppShell";
import { useApp } from "@/hooks/useAppState";
import { createRoom, joinRoom, listPublicRooms, type Room } from "@/lib/rooms";

export const Route = createFileRoute("/online")({
  head: () => ({
    meta: [
      { title: "Play online — public WallRush rooms" },
      {
        name: "description",
        content: "Browse open public WallRush rooms and jump into a 1v1 Quoridor match against a real player.",
      },
      { property: "og:title", content: "Play online — public WallRush rooms" },
      { property: "og:description", content: "Open rooms waiting for a second player. Join in one tap." },
    ],
  }),
  component: Online,
});

function Online() {
  const app = useApp();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listPublicRooms()
      .then(setRooms)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function join(code: string) {
    setError(null);
    setBusy(true);
    try {
      const room = await joinRoom(code, app.local.token, app.displayName);
      navigate({ to: "/room/$code", params: { code: room.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setError(null);
    setBusy(true);
    try {
      const room = await createRoom({ isPublic: true, token: app.local.token, name: app.displayName });
      navigate({ to: "/room/$code", params: { code: room.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create room");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Play online" subtitle="Public rooms" />
      <div className="mx-auto w-full max-w-md px-4">
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="w-full rounded-2xl bg-primary px-4 py-3.5 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-raised)] disabled:opacity-60"
        >
          Create public room
        </button>
        {error && <p className="mt-3 text-sm font-semibold text-destructive">{error}</p>}

        <h2 className="mt-6 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
          Open rooms ({rooms.length})
        </h2>
        <div className="mt-2 space-y-2 pb-6">
          {rooms.length === 0 && (
            <p className="card-surface p-4 text-sm text-muted-foreground">
              No open rooms right now. Create one and your opponent will drop straight in.
            </p>
          )}
          {rooms.map((r) => (
            <div key={r.id} className="card-surface flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-lg">🌐</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{r.p1_name ?? "Player"}</p>
                <p className="text-xs text-muted-foreground">Room {r.code} · 1/2 seats</p>
              </div>
              <button
                type="button"
                disabled={busy || r.p1_token === app.local.token}
                onClick={() => join(r.code)}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {r.p1_token === app.local.token ? "Yours" : "Join"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
