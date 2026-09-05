export const N = 9;

export type Orient = "h" | "v";
export interface WallInventory { h: number; v: number; }
export interface Wall {
  r: number; // 0..7
  c: number; // 0..7
  o: Orient;
  by?: 0 | 1;
}
export interface Pos {
  r: number;
  c: number;
}
export interface GameState {
  pawns: Pos[];
  walls: Wall[];
  wallsLeft: WallInventory[];
  turn: number;
  winner: number | null;
  moveCount: number;
  history: string[];
}

export function initialState(): GameState {
  return {
    pawns: [
      { r: 8, c: 4 },
      { r: 0, c: 4 },
    ],
    walls: [],
    wallsLeft: [{ h: 5, v: 5 }, { h: 5, v: 5 }],
    turn: 0,
    winner: null,
    moveCount: 0,
    history: [],
  };
}

export function playerCount(s: GameState) {
  return s.pawns.length;
}

export function wallKey(w: Wall) {
  return `${w.o}${w.r}-${w.c}`;
}
export function samePos(a: Pos, b: Pos) {
  return a.r === b.r && a.c === b.c;
}
export function inBoard(p: Pos) {
  return p.r >= 0 && p.r < N && p.c >= 0 && p.c < N;
}

/** Is movement between two orthogonally-adjacent cells blocked by a wall? */
export function blocked(walls: Wall[], a: Pos, b: Pos): boolean {
  const dr = b.r - a.r;
  const dc = b.c - a.c;
  for (const w of walls) {
    if (dr !== 0 && dc === 0) {
      // vertical movement -> horizontal wall
      if (w.o !== "h") continue;
      const top = Math.min(a.r, b.r);
      if (w.r === top && (w.c === a.c || w.c + 1 === a.c)) return true;
    } else if (dc !== 0 && dr === 0) {
      if (w.o !== "v") continue;
      const left = Math.min(a.c, b.c);
      if (w.c === left && (w.r === a.r || w.r + 1 === a.r)) return true;
    }
  }
  return false;
}

const DIRS: Pos[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
];

/** Plain step neighbours ignoring pawns. */
function stepNeighbours(walls: Wall[], p: Pos): Pos[] {
  const out: Pos[] = [];
  for (const d of DIRS) {
    const n = { r: p.r + d.r, c: p.c + d.c };
    if (!inBoard(n)) continue;
    if (blocked(walls, p, n)) continue;
    out.push(n);
  }
  return out;
}

export function goalRow(player: number) {
  return player === 0 ? 0 : 8;
}

export function hasReachedGoal(player: number, pos: Pos) {
  if (player === 0) return pos.r === 0;
  if (player === 1) return pos.r === N - 1;
  if (player === 2) return pos.c === N - 1;
  return pos.c === 0;
}

/** Legal pawn destinations including jumps. */
export function legalMoves(s: GameState, player: number): Pos[] {
  const me = s.pawns[player]!;
  const res: Pos[] = [];
  for (const d of DIRS) {
    const n = { r: me.r + d.r, c: me.c + d.c };
    if (!inBoard(n) || blocked(s.walls, me, n)) continue;
    const occupied = s.pawns.findIndex((pawn, index) => index !== player && samePos(pawn, n));
    if (occupied === -1) {
      res.push(n);
      continue;
    }
    // opponent there -> try jump straight over
    const j = { r: n.r + d.r, c: n.c + d.c };
    if (inBoard(j) && !blocked(s.walls, n, j) && !s.pawns.some((pawn, index) => index !== player && samePos(pawn, j))) {
      res.push(j);
    } else {
      // diagonals around the opponent
      for (const d2 of DIRS) {
        if (d2.r === d.r && d2.c === d.c) continue;
        if (d2.r === -d.r && d2.c === -d.c) continue;
        const dg = { r: n.r + d2.r, c: n.c + d2.c };
        if (inBoard(dg) && !blocked(s.walls, n, dg) && !s.pawns.some((pawn, index) => index !== player && samePos(pawn, dg))) res.push(dg);
      }
    }
  }
  const seen = new Set<string>();
  return res.filter((p) => {
    const k = `${p.r},${p.c}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Shortest path length to the goal row, or Infinity if unreachable. */
export function distanceToGoal(walls: Wall[], from: Pos, player: number): number {
  const dist = new Map<string, number>();
  const q: Pos[] = [from];
  dist.set(`${from.r},${from.c}`, 0);
  while (q.length) {
    const cur = q.shift()!;
    const d = dist.get(`${cur.r},${cur.c}`)!;
    if (hasReachedGoal(player, cur)) return d;
    for (const n of stepNeighbours(walls, cur)) {
      const k = `${n.r},${n.c}`;
      if (dist.has(k)) continue;
      dist.set(k, d + 1);
      q.push(n);
    }
  }
  return Infinity;
}

export function wallConflicts(walls: Wall[], w: Wall): boolean {
  if (w.r < 0 || w.r > N - 2 || w.c < 0 || w.c > N - 2) return true;
  for (const e of walls) {
    if (e.o === w.o) {
      if (w.o === "h" && e.r === w.r && Math.abs(e.c - w.c) <= 1) return true;
      if (w.o === "v" && e.c === w.c && Math.abs(e.r - w.r) <= 1) return true;
    } else if (e.r === w.r && e.c === w.c) {
      return true; // crossing
    }
  }
  return false;
}

function inventoryValue(value: WallInventory | number | undefined): WallInventory {
  if (typeof value === "number") return { h: value > 0 ? 1 : 0, v: value > 0 ? 1 : 0 };
  return value ?? { h: 0, v: 0 };
}

function inventoryFor(s: GameState, player: number): WallInventory {
  return inventoryValue(s.wallsLeft[player] as WallInventory | number | undefined);
}

export function wallCount(s: GameState, player: number) {
  const inventory = inventoryFor(s, player);
  return inventory.h + inventory.v;
}

export function canPlaceWall(s: GameState, w: Wall, player: number): boolean {
  if (s.winner !== null) return false;
  if (inventoryFor(s, player)[w.o] <= 0) return false;
  if (wallConflicts(s.walls, w)) return false;
  const next = [...s.walls, w];
  if (s.pawns.some((pawn, index) => distanceToGoal(next, pawn, index) === Infinity)) return false;
  return true;
}

const COLS = "abcdefghi";
function notate(p: Pos) {
  return `${COLS[p.c]}${N - p.r}`;
}

export function applyMove(s: GameState, to: Pos): GameState {
  const player = s.turn;
  if (s.winner !== null) return s;
  if (!legalMoves(s, player).some((p) => samePos(p, to))) return s;
  const pawns = s.pawns.map((pawn) => ({ ...pawn }));
  pawns[player] = to;
  const winner = hasReachedGoal(player, to) ? player : null;
  return {
    ...s,
    pawns,
    turn: (player + 1) % s.pawns.length,
    winner,
    moveCount: s.moveCount + 1,
    history: [...s.history, notate(to)],
  };
}

export function applyWall(s: GameState, w: Wall): GameState {
  const player = s.turn;
  if (!canPlaceWall(s, w, player)) return s;
  const wallsLeft = s.wallsLeft.map((inventory, index) => {
    const current = inventoryValue(inventory as WallInventory | number);
    return index === player ? { ...current, [w.o]: Math.max(0, current[w.o] - 1) } : { ...current };
  });
  return {
    ...s,
    walls: [...s.walls, { ...w, by: player as 0 | 1 }],
    wallsLeft,
    turn: (player + 1) % s.pawns.length,
    moveCount: s.moveCount + 1,
    history: [...s.history, `${w.o}${COLS[w.c]}${N - 1 - w.r}`],
  };
}

export function legalWalls(s: GameState, player: number): Wall[] {
  const out: Wall[] = [];
  const inventory = inventoryFor(s, player);
  if (inventory.h <= 0 && inventory.v <= 0) return out;
  for (let r = 0; r < N - 1; r++)
    for (let c = 0; c < N - 1; c++)
      for (const o of ["h", "v"] as Orient[]) {
        const w = { r, c, o };
        if (canPlaceWall(s, w, player)) out.push(w);
      }
  return out;
}
