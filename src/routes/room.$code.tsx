import { useCallback, useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import GameView from "@/components/GameView";
import { useApp } from "@/hooks/useAppState";
import { api } from "@/lib/api";
import { beep, vibrate } from "@/lib/local";
import { chooseAction } from "@/lib/ai";
import { type Pos, type Wall } from "@/lib/quoridor";
import {
  fetchRoom,
  joinRoom,
  leaveRoom,
  saveRoomAction,
  seatOf,
  type Room,
} from "@/lib/rooms";

export const Route = createFileRoute("/room/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — WallRush 1v1 match` },
      {
        name: "description",
        content:
          "You're in a live WallRush room. Share the code with a friend and race your pawn to the other side of the board.",
      },
      { property: "og:title", content: `WallRush room ${params.code}` },
      {
        property: "og:description",
        content: "Join this live 1v1 Quoridor match on WallRush — free, no signup.",
      },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { code } = Route.useParams();
  const app = useApp();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const recorded = useRef(false);
  const roomRef = useRef<Room | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const joined = await joinRoom(code.toUpperCase(), app.local.token, app.displayName);
        if (alive) { roomRef.current = joined; setRoom(joined); }
      } catch {
        const existing = await fetchRoom(code);
        if (!alive) return;
        if (existing) { roomRef.current = existing; setRoom(existing); }
        else setError("This room no longer exists.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [code, app.local.token, app.displayName]);

  useEffect(() => {
    let alive = true;
    const poll = () => fetchRoom(code).then((current) => {
      if (alive && current && current.updated_at !== roomRef.current?.updated_at && current.state.game.moveCount >= (roomRef.current?.state.game.moveCount ?? 0)) {
        roomRef.current = current;
        setRoom(current);
      }
    }).catch(() => {});
    const timer = window.setInterval(poll, 2000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [code]);

  useEffect(() => {
    if (!room || room.p2_token || !room.is_public || room.status !== "waiting") return;
    const timer = window.setTimeout(() => {
      void api.startBot(room.code, app.local.token).then(({ room: started }) => { roomRef.current = started; setRoom(started); }).catch(() => {});
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [room?.code, room?.p2_token, room?.is_public, room?.status, app.local.token]);

  const seat = room ? seatOf(room, app.local.token) : null;
  const state = room?.state?.game ?? null;

  useEffect(() => {
    if (!room || !state || seat !== 0 || !room.is_bot || state.turn !== 1 || state.winner !== null) return;
    const timer = window.setTimeout(() => {
      const action = chooseAction(state, 1, "hardcore");
      const botToken = room.p2_token;
      if (!botToken) return;
      void saveRoomAction(room.code, botToken, action, state.moveCount).then((updated) => { roomRef.current = updated; setRoom(updated); }).catch(() => {});
    }, 500);
    return () => window.clearTimeout(timer);
  }, [room, state, seat, app.local.token]);

  useEffect(() => {
    if (!room || seat === null || recorded.current) return;
    const winner = room.state?.game?.winner ?? room.winner;
    if (winner === null || winner === undefined) return;
    recorded.current = true;
    const isBot = room.is_bot;
    void app.recordResult(winner === seat, {
      opponentType: isBot ? "ai" : "human",
      opponentName: (seat === 0 ? room.p2_name : room.p1_name) ?? "Player",
      roomCode: room.code,
      ranked: !isBot,
    });
  }, [room, seat, app]);

  const pushAction = useCallback(
    async (action: Parameters<typeof saveRoomAction>[2]) => {
      const current = roomRef.current;
      if (!current || submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      try {
        const updated = await saveRoomAction(current.code, app.local.token, action, current.state.game.moveCount);
        roomRef.current = updated;
        setRoom(updated);
      } catch {
        const synced = await fetchRoom(current.code).catch(() => null);
        if (synced) { roomRef.current = synced; setRoom(synced); }
        else setError("Could not sync that move. Check your connection.");
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [app.local.token],
  );

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="text-lg font-extrabold">{error}</p>
          <Link to="/" className="mt-4 inline-block rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  if (!room || !state || seat === null) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="text-lg font-extrabold">
            {room && seat === null ? "This room is full" : "Loading room…"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Room {code.toUpperCase()}</p>
          <Link to="/" className="mt-4 inline-block rounded-xl bg-muted px-4 py-2.5 text-sm font-bold">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  const oppName = (seat === 0 ? room.p2_name : room.p1_name) ?? null;
  const waiting = !oppName;

  if (waiting) {
    return (
      <div className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-6 text-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-muted-foreground">Room code</p>
          <p className="mt-2 text-5xl font-black tracking-[0.2em]">{room.code}</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(room.code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            {copied ? "Copied!" : "Copy code"}
          </button>
          <p className="mt-6 animate-pulse text-sm text-muted-foreground">Waiting for an opponent to join…</p>
          <button
            type="button"
            onClick={() => {
              void leaveRoom(room.code, app.local.token).finally(() => window.location.assign("/"));
            }}
            className="mt-6 text-sm font-bold text-muted-foreground"
          >
            ← Leave room
          </button>
        </div>
      </div>
    );
  }

  const resignedBy = room.state.resignedBy ?? null;
  const resultOverride =
    resignedBy === null ? null : resignedBy === seat ? "You resigned" : "Opponent resigned — you win!";

  function onMove(p: Pos) {
    vibrate(app.settings.vibration);
    beep(app.settings.sound);
    void pushAction({ type: "move", to: p });
  }

  function onWall(w: Wall) {
    vibrate(app.settings.vibration);
    beep(app.settings.sound, 420);
    void pushAction({ type: "wall", wall: w });
  }

  function onResign() {
    void pushAction({ type: "resign" });
  }

  function onEmote(emoji: string) {
    void pushAction({ type: "emote", emoji });
  }

  function onRematch() {
    recorded.current = false;
    void pushAction({ type: "rematch" });
  }

  return (
    <GameView
      title={`Room ${room.code}`}
      state={state}
      mySeat={seat}
      myName={app.displayName}
      oppName={oppName}
      interactive={resignedBy === null && state.winner === null && !submitting}
      clocks={{ ...room.state.clocks, running: state.winner === null && resignedBy === null }}
      emote={room.state.emote ?? null}
      onMove={onMove}
      onWall={onWall}
      onResign={onResign}
      onEmote={onEmote}
      onRematch={onRematch}
      resultOverride={resultOverride}
    />
  );
}
