import { useMemo, useRef, type PointerEvent } from "react";
import { N, type GameState, type Orient, type Pos, type Wall, canPlaceWall, legalMoves, samePos } from "@/lib/quoridor";

interface Props {
  state: GameState;
  /** Which seat the human controls (null = spectate / both handled outside). */
  me: 0 | 1;
  interactive: boolean;
  draggingOrient?: Orient | null;
  preview?: Wall | null;
  mode?: "move" | "wall";
  orient?: Orient;
  flipped?: boolean;
  onMove: (p: Pos) => void;
  onPreview?: (w: Wall | null) => void;
  onDrop?: (w: Wall) => void;
  onWall?: (w: Wall) => void;
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

export default function Board({ state, me, interactive, draggingOrient, preview, flipped, onMove, onPreview, onDrop }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const moves = useMemo(
    () => (interactive && !draggingOrient && state.winner === null ? legalMoves(state, me) : []),
    [state, me, interactive, draggingOrient],
  );

  function wallAtPoint(event: PointerEvent<HTMLDivElement>): Wall | null {
    if (!draggingOrient || !boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    let x = (event.clientX - rect.left) / rect.width;
    let y = (event.clientY - rect.top) / rect.height;
    if (flipped) { x = 1 - x; y = 1 - y; }
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    const gap = 10 / rect.width;
    const cell = (1 - 8 * gap) / 9;
    const c = Math.round((x - cell - gap / 2) / (cell + gap));
    const r = Math.round((y - cell - gap / 2) / (cell + gap));
    if (r < 0 || r > 7 || c < 0 || c > 7) return null;
    return { r, c, o: draggingOrient };
  }

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
      className={`pointer-events-none z-20 rounded-[3px] shadow-[0_2px_4px_rgba(0,0,0,0.22)] ${w.by === undefined || w.by === me ? "bg-blue-600" : "bg-red-500"}`}
      style={
        w.o === "h"
          ? { gridRow: 2 * w.r + 2, gridColumn: `${2 * w.c + 1} / span 3`, height: "38%", alignSelf: "center" }
          : { gridColumn: 2 * w.c + 2, gridRow: `${2 * w.r + 1} / span 3`, width: "38%", justifySelf: "center" }
      }
    />
  ));

  return (
    <div
      ref={boardRef}
      className="relative grid aspect-square w-full gap-0 rounded-2xl bg-board p-2 shadow-[var(--shadow-card)] touch-none"
      style={{
        gridTemplateColumns: template(),
        gridTemplateRows: template(),
        transform: flipped ? "rotate(180deg)" : undefined,
      }}
    >
      {cells}
      {wallEls}
      {preview && <div className={`pointer-events-none z-30 rounded-[3px] ${canPlaceWall(state, preview, me) ? "bg-blue-600/70" : "bg-destructive/70"}`} style={preview.o === "h" ? { gridRow: 2 * preview.r + 2, gridColumn: `${2 * preview.c + 1} / span 3`, height: "55%", alignSelf: "center" } : { gridColumn: 2 * preview.c + 2, gridRow: `${2 * preview.r + 1} / span 3`, width: "55%", justifySelf: "center" }} />}
      {draggingOrient && <div className="absolute inset-0 z-40" onPointerMove={(event) => onPreview?.(wallAtPoint(event))} onPointerLeave={() => onPreview?.(null)} onPointerUp={(event) => { const wall = wallAtPoint(event); if (wall && canPlaceWall(state, wall, me)) onDrop?.(wall); }} />}
    </div>
  );
}
