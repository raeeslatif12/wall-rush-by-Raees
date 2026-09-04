import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import Board from "./Board";
import type { GameState, Orient, Pos, Wall } from "@/lib/quoridor";

export interface Clocks {
  base: [number, number];
  lastMoveAt: number;
  running: boolean;
}

interface Props {
  title: string;
  state: GameState;
  mySeat: 0 | 1;
  myName: string;
  oppName: string;
  interactive: boolean;
  clocks: Clocks | null;
  emote?: { seat: 0 | 1; emoji: string } | null;
  statusLine?: string;
  onMove: (p: Pos) => void;
  onWall: (w: Wall) => void;
  onResign: () => void;
  onEmote?: (emoji: string) => void;
  onRematch?: () => void;
  resultOverride?: string | null;
}

const EMOTES = ["😂", "🫡", "🤝", "😡"];

function fmt(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function GameView({
  title,
  state,
  mySeat,
  myName,
  oppName,
  interactive,
  clocks,
  emote,
  statusLine,
  onMove,
  onWall,
  onResign,
  onEmote,
  onRematch,
  resultOverride,
}: Props) {
  const [mode, setMode] = useState<"move" | "wall">("move");
  const [orient, setOrient] = useState<Orient>("h");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!clocks?.running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [clocks?.running]);

  const oppSeat = (mySeat === 0 ? 1 : 0) as 0 | 1;
  const elapsed = clocks && clocks.running ? (now - clocks.lastMoveAt) / 1000 : 0;
  const left: [number, number] = clocks
    ? [
        clocks.base[0] - (state.turn === 0 ? elapsed : 0),
        clocks.base[1] - (state.turn === 1 ? elapsed : 0),
      ]
    : [0, 0];

  const myTurn = state.turn === mySeat && state.winner === null && interactive;
  const result =
    resultOverride ??
    (state.winner === null ? null : state.winner === mySeat ? "You won! 🎉" : "You lost");

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <Link to="/" className="text-lg font-extrabold text-primary">
          WallRush
        </Link>
        <button
          type="button"
          onClick={onResign}
          disabled={!myTurn}
          className="rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-bold text-destructive"
        >
          ⚑ Resign
        </button>
      </div>

      <div className="card-surface mb-3 flex items-center justify-between p-3">
        <Seat name={oppName} walls={state.wallsLeft[oppSeat]} time={clocks ? fmt(left[oppSeat]) : null} active={state.turn === oppSeat} color="p2" emoji={emote?.seat === oppSeat ? emote.emoji : null} />
        <span className="px-2 text-xs font-bold text-muted-foreground">VS</span>
        <Seat name={myName} walls={state.wallsLeft[mySeat]} time={clocks ? fmt(left[mySeat]) : null} active={state.turn === mySeat} color="p1" emoji={emote?.seat === mySeat ? emote.emoji : null} right />
      </div>

      <p className="mb-2 text-center text-xs font-semibold text-muted-foreground">
        {statusLine ?? (myTurn ? "Your move — tap a cell, or place a wall" : "Waiting for opponent…")}
      </p>

      <Board
        state={state}
        me={mySeat}
        interactive={myTurn}
        mode={mode}
        orient={orient}
        onMove={(p) => {
          onMove(p);
          setMode("move");
        }}
        onWall={(w) => {
          onWall(w);
          setMode("move");
        }}
      />

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("move")}
          disabled={!myTurn}
          className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${mode === "move" ? "bg-primary text-primary-foreground" : "card-surface"}`}
        >
          Move
        </button>
        <button
          type="button"
          onClick={() => setMode("wall")}
          disabled={!myTurn}
          className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${mode === "wall" ? "bg-primary text-primary-foreground" : "card-surface"}`}
        >
          🧱 Wall {state.wallsLeft[mySeat]}
        </button>
        <button
          type="button"
          onClick={() => setOrient((o) => (o === "h" ? "v" : "h"))}
          disabled={!myTurn}
          className="card-surface px-3 py-2.5 text-sm font-bold"
          aria-label="toggle wall orientation"
        >
          {orient === "h" ? "▬" : "▮"}
        </button>
      </div>

      {onEmote && (
        <div className="mt-3 flex justify-center gap-2">
          {EMOTES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onEmote(e)}
              className="card-surface px-3 py-2 text-lg"
              aria-label={`send ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 card-surface p-3 text-center text-xs text-muted-foreground">
        Moves played: <span className="font-bold text-foreground">{state.moveCount}</span>
        {state.history.length > 0 && (
          <span className="ml-2">last: {state.history[state.history.length - 1]}</span>
        )}
      </div>

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-6">
          <div className="card-surface w-full max-w-xs p-6 text-center">
            <p className="text-2xl font-extrabold">{result}</p>
            <p className="mt-1 text-sm text-muted-foreground">{title}</p>
            <div className="mt-5 flex flex-col gap-2">
              {onRematch && (
                <button
                  type="button"
                  onClick={onRematch}
                  className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
                >
                  Play again
                </button>
              )}
              <Link to="/" className="rounded-xl bg-muted px-4 py-3 text-sm font-bold">
                Home
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Seat({
  name,
  walls,
  time,
  active,
  color,
  emoji,
  right,
}: {
  name: string;
  walls: number;
  time: string | null;
  active: boolean;
  color: "p1" | "p2";
  emoji?: string | null;
  right?: boolean;
}) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${right ? "flex-row-reverse text-right" : ""}`}>
      <span className={`h-8 w-8 shrink-0 rounded-full ${color === "p1" ? "bg-p1" : "bg-p2"}`} />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">
          {name} {emoji}
        </p>
        <p className="text-xs text-muted-foreground">
          {walls} 🧱 {time && <span className={active ? "font-bold text-foreground" : ""}>· {time}</span>}
        </p>
      </div>
    </div>
  );
}
