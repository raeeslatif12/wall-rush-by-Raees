import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import AppShell, { PageHeader } from "@/components/AppShell";
import { useApp } from "@/hooks/useAppState";
import { createRoom, joinRoom } from "@/lib/rooms";

export const Route = createFileRoute("/friend")({
  head: () => ({
    meta: [
      { title: "Play with a friend — WallRush private rooms" },
      {
        name: "description",
        content:
          "Create a private WallRush room, share the 6-character code, and play Quoridor 1v1 with a friend in seconds.",
      },
      { property: "og:title", content: "Play WallRush with a friend" },
      {
        property: "og:description",
        content: "Private rooms by code. No signup, no download — just share the code and play.",
      },
    ],
  }),
  component: Friend,
});

function Friend() {
  const app = useApp();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    setBusy("create");
    try {
      const room = await createRoom({ isPublic: false, token: app.local.token, name: app.displayName });
      navigate({ to: "/room/$code", params: { code: room.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the room");
    } finally {
      setBusy(null);
    }
  }

  async function join() {
    setError(null);
    if (code.trim().length < 4) {
      setError("Enter the 6-character code your friend sent you.");
      return;
    }
    setBusy("join");
    try {
      const room = await joinRoom(code.trim().toUpperCase(), app.local.token, app.displayName);
      navigate({ to: "/room/$code", params: { code: room.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join that room");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Play with friend" subtitle="Private room via code" />
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-8">
        <div className="card-surface p-4">
          <p className="text-sm font-bold">1. Create a room</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You get a 6-character code. Send it to your friend and the match starts the moment they join.
          </p>
          <button
            type="button"
            onClick={create}
            disabled={busy !== null}
            className="mt-3 w-full rounded-xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
          >
            {busy === "create" ? "Creating…" : "Create room with code"}
          </button>
        </div>

        <div className="card-surface p-4">
          <p className="text-sm font-bold">2. Or join theirs</p>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-3 text-center text-lg font-black tracking-[0.3em] outline-none focus:border-ring"
            />
            <button
              type="button"
              onClick={join}
              disabled={busy !== null}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
            >
              {busy === "join" ? "…" : "Join"}
            </button>
          </div>
        </div>

        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

        <p className="px-1 text-xs text-muted-foreground">
          Friend matches count towards your points, just like public rooms.
        </p>
      </div>
    </AppShell>
  );
}
