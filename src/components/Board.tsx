import { useMemo } from "react";
import { N, type GameState, type Orient, type Pos, type Wall, canPlaceWall, legalMoves, samePos } from "@/lib/quoridor";

interface Props {
  state: GameState;
  /** Which seat the human controls (null = spectate / both handled outside). */
  me: 0 | 1;
  interactive: boolean;
  mode: "move" | "wall";
  orient: Orient;
  flipped?: boolean;
  onMove: (p: Pos) => void;
  onWall: (w: Wall) => void;
}

const CELL = "minmax(0, 1fr)";
const GAP = "10px";

function template() {
  const parts: string[] = [];
  for (let i = 0; i < N; i++) {
    parts.push(CELL);
    if (i < N - 1) parts.push(GAP);
  }
  return parts.join(" ");
}

export default function Board({ state, me, interactive, mode, orient, flipped, onMove, onWall }: Props) {
  const moves = useMemo(
    () => (interactive && mode === "move" && state.winner === null ? legalMoves(state, me) : []),
    [state, me, interactive, mode],
  );

  const cells = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const pos = { r, c };
      const isMove = moves.some((m) => samePos(m, pos));
      const isGoal = r === 0 || r === N - 1;
      const pawnSeat = state.pawns.findIndex((pawn) => samePos(pawn, pos));
      cells.push(
        <button
          key={`c${r}-${c}`}
          type="button"
          aria-label={`cell ${r}-${c}`}
          disabled={!isMove}
          onClick={() => isMove && onMove(pos)}
          className={[
            "relative rounded-[5px] transition-colors",
            isGoal ? "bg-board-goal" : "bg-board-cell",
            isMove ? "ring-2 ring-primary/70 cursor-pointer" : "",
          ].join(" ")}
          style={{ gridRow: 2 * r + 1, gridColumn: 2 * c + 1 }}
        >
          {isMove && (
            <span className="absolute left-1/2 top-1/2 h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/50" />
          )}
          {pawnSeat >= 0 && (
            <span
              className={[
                "absolute left-1/2 top-1/2 h-[74%] w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.25)]",
                pawnSeat === me ? "bg-p1" : "bg-p2",
              ].join(" ")}
            />
          )}
        </button>,
      );
    }
  }

  const wallEls = state.walls.map((w) => (
    <div
      key={`w${w.o}${w.r}-${w.c}`}
      className="pointer-events-none z-20 rounded-[3px] bg-wall shadow-[0_2px_4px_rgba(0,0,0,0.22)]"
      style={
        w.o === "h"
          ? { gridRow: 2 * w.r + 2, gridColumn: `${2 * w.c + 1} / span 3`, height: "38%", alignSelf: "center" }
          : { gridColumn: 2 * w.c + 2, gridRow: `${2 * w.r + 1} / span 3`, width: "38%", justifySelf: "center" }
      }
    />
  ));

  const slots = [];
  if (interactive && mode === "wall" && state.winner === null) {
    for (let r = 0; r < N - 1; r++) {
      for (let c = 0; c < N - 1; c++) {
        const w: Wall = { r, c, o: orient };
        const ok = canPlaceWall(state, w, me);
        slots.push(
          <button
            key={`s${r}-${c}`}
            type="button"
            aria-label={`wall ${orient} ${r}-${c}`}
            disabled={!ok}
            onClick={() => ok && onWall(w)}
            className={[
              "group z-30 flex items-center justify-center rounded-[3px] transition-opacity",
              ok ? "cursor-pointer opacity-100" : "pointer-events-none opacity-0",
            ].join(" ")}
            style={
              orient === "h"
                ? { gridRow: 2 * r + 2, gridColumn: `${2 * c + 1} / span 3` }
                : { gridColumn: 2 * c + 2, gridRow: `${2 * r + 1} / span 3` }
            }
          >
            <span
              className={[
                "block rounded-[3px] bg-primary/35 shadow-[0_1px_3px_rgba(0,0,0,0.14)] transition-all",
                orient === "h" ? "h-[38%] w-full" : "h-full w-[38%]",
                "group-hover:bg-primary group-hover:shadow-[0_2px_6px_rgba(0,0,0,0.25)]",
              ].join(" ")}
            />
          </button>,
        );
      }
    }
  }

  return (
    <div
      className="grid aspect-square w-full gap-0 rounded-2xl bg-board p-2 shadow-[var(--shadow-card)]"
      style={{
        gridTemplateColumns: template(),
        gridTemplateRows: template(),
        transform: flipped ? "rotate(180deg)" : undefined,
      }}
    >
      {cells}
      {wallEls}
      {slots}
    </div>
  );
}
