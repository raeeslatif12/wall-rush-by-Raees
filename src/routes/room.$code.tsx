import { useCallback, useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import GameView from "@/components/GameView";
import { useApp } from "@/hooks/useAppState";
import { api } from "@/lib/api";
import { beep, vibrate } from "@/lib/local";
import { chooseAction } from "@/lib/ai";
import { applyMove, applyWall, type Pos, type Wall } from "@/lib/quoridor";
import {
  START_SECONDS,
  fetchRoom,
  freshRoomState,
  joinRoom,
  leaveRoom,
  saveRoomState,
  seatOf,
  type Room,
  type RoomState,
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
  const recorded = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const joined = await joinRoom(code.toUpperCase(), app.local.token, app.displayName);
        if (alive) setRoom(joined);
      } catch {
        const existing = await fetchRoom(code);
        if (!alive) return;
        if (existing) setRoom(existing);
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
      if (alive && current) setRoom(current);
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
      void api.startBot(room.code, app.local.token).then(({ room: started }) => setRoom(started)).catch(() => {});
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [room?.code, room?.p2_token, room?.is_public, room?.status, app.local.token]);

  const seat = room ? seatOf(room, app.local.token) : null;
  const state = room?.state?.game ?? null;

  useEffect(() => {
    if (!room || !state || seat !== 0 || !room.is_bot || state.turn !== 1 || state.winner !== null) return;
    const timer = window.setTimeout(() => {
      const action = chooseAction(state, 1, "hardcore");
      const next = action.type === "move" ? applyMove(state, action.to) : applyWall(state, action.wall);
      void saveRoomState(room.code, app.local.token, { ...room.state, game: next }, next.winner === null ? {} : { status: "done", winner: next.winner });
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
      ranked: !isBot,
    });
  }, [room, seat, app]);

  const push = useCallback(
    async (next: RoomState, extra: { status?: string; winner?: number | null } = {}) => {
      if (!room) return;
      setRoom({ ...room, state: next, ...extra } as Room);
      try {
        await saveRoomState(room.code, app.local.token, next, extra);
      } catch {
        setError("Could not sync that move. Check your connection.");
      }
    },
    [room],
  );

  const advanceClock = useCallback(
    (prev: RoomState, mover: 0 | 1): RoomState["clocks"] => {
      const elapsed = (Date.now() - prev.clocks.lastMoveAt) / 1000;
      const base: [number, number] = [...prev.clocks.base] as [number, number];
      base[mover] = Math.max(0, base[mover] - elapsed);
      return { base, lastMoveAt: Date.now() };
    },
    [],
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
    const next = applyMove(state!, p);
    vibrate(app.settings.vibration);
    beep(app.settings.sound);
    void push(
      { ...room!.state, game: next, clocks: advanceClock(room!.state, seat as 0 | 1) },
      next.winner === null ? {} : { status: "done", winner: next.winner },
    );
  }

  function onWall(w: Wall) {
    const next = applyWall(state!, w);
    vibrate(app.settings.vibration);
    beep(app.settings.sound, 420);
    void push({ ...room!.state, game: next, clocks: advanceClock(room!.state, seat as 0 | 1) });
  }

  function onResign() {
    void push({ ...room!.state, resignedBy: seat as 0 | 1 }, { status: "done", winner: seat === 0 ? 1 : 0 });
  }

  function onEmote(emoji: string) {
    void push({ ...room!.state, emote: { seat: seat as 0 | 1, emoji, at: Date.now() } });
  }

  function onRematch() {
    recorded.current = false;
    const fresh = freshRoomState();
    fresh.clocks = { base: [START_SECONDS, START_SECONDS], lastMoveAt: Date.now() };
    void push(fresh, { status: "playing", winner: null });
  }

  return (
    <GameView
      title={`Room ${room.code}`}
      state={state}
      mySeat={seat}
      myName={app.displayName}
      oppName={oppName}
      interactive={resignedBy === null}
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
