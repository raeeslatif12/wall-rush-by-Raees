import {
  type GameState,
  type Pos,
  type Wall,
  applyMove,
  applyWall,
  distanceToGoal,
  legalMoves,
  legalWalls,
} from "./quoridor";

export type Difficulty = "easy" | "normal" | "hard" | "hardcore";

export type Action = { type: "move"; to: Pos } | { type: "wall"; wall: Wall };

function evaluate(s: GameState, me: 0 | 1): number {
  const opp = (me === 0 ? 1 : 0) as 0 | 1;
  const dMe = distanceToGoal(s.walls, s.pawns[me], me);
  const dOpp = distanceToGoal(s.walls, s.pawns[opp], opp);
  if (dMe === 0) return 1000;
  if (dOpp === 0) return -1000;
  const wallBonus = (s.wallsLeft[me] - s.wallsLeft[opp]) * 0.6;
  return (dOpp - dMe) * 3 + wallBonus;
}

function apply(s: GameState, a: Action): GameState {
  return a.type === "move" ? applyMove(s, a.to) : applyWall(s, a.wall);
}

/** Walls worth considering: those that lengthen the opponent's path most. */
function candidateWalls(s: GameState, me: 0 | 1, limit: number): Wall[] {
  const opp = (me === 0 ? 1 : 0) as 0 | 1;
  const base = distanceToGoal(s.walls, s.pawns[opp], opp);
  const myBase = distanceToGoal(s.walls, s.pawns[me], me);
  const scored = legalWalls(s, me).map((w) => {
    const walls = [...s.walls, w];
    const d = distanceToGoal(walls, s.pawns[opp], opp);
    const dm = distanceToGoal(walls, s.pawns[me], me);
    return { w, score: d - base - (dm - myBase) * 1.2 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((x) => x.score > 0).slice(0, limit).map((x) => x.w);
}

function bestPawnMove(s: GameState, me: 0 | 1): Pos {
  const moves = legalMoves(s, me);
  let best = moves[0]!;
  let bestD = Infinity;
  for (const m of moves) {
    const d = distanceToGoal(s.walls, m, me);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

function search(s: GameState, me: 0 | 1, depth: number, actions: Action[]): { score: number; action: Action } {
  let bestScore = -Infinity;
  let bestAction = actions[0]!;
  for (const a of actions) {
    const ns = apply(s, a);
    if (ns === s) continue;
    let score: number;
    if (ns.winner === me) score = 2000;
    else if (depth <= 1) score = evaluate(ns, me);
    else {
      const opp = (me === 0 ? 1 : 0) as 0 | 1;
      const oppActions: Action[] = [
        ...legalMoves(ns, opp).map((to) => ({ type: "move" as const, to })),
        ...candidateWalls(ns, opp, 6).map((wall) => ({ type: "wall" as const, wall })),
      ];
      const reply = search(ns, opp, depth - 1, oppActions);
      score = -reply.score;
    }
    if (score > bestScore) {
      bestScore = score;
      bestAction = a;
    }
  }
  return { score: bestScore, action: bestAction };
}

export function chooseAction(s: GameState, me: 0 | 1, difficulty: Difficulty): Action {
  const moves = legalMoves(s, me);

  if (difficulty === "easy") {
    if (Math.random() < 0.35) {
      const m = moves[Math.floor(Math.random() * moves.length)]!;
      return { type: "move", to: m };
    }
    if (Math.random() < 0.12) {
      const w = candidateWalls(s, me, 12);
      if (w.length) return { type: "wall", wall: w[Math.floor(Math.random() * w.length)]! };
    }
    return { type: "move", to: bestPawnMove(s, me) };
  }

  if (difficulty === "normal") {
    const opp = (me === 0 ? 1 : 0) as 0 | 1;
    const dMe = distanceToGoal(s.walls, s.pawns[me], me);
    const dOpp = distanceToGoal(s.walls, s.pawns[opp], opp);
    if (dOpp < dMe && s.wallsLeft[me] > 0 && Math.random() < 0.6) {
      const w = candidateWalls(s, me, 4);
      if (w.length) return { type: "wall", wall: w[0]! };
    }
    return { type: "move", to: bestPawnMove(s, me) };
  }

  const wallLimit = difficulty === "hard" ? 8 : 12;
  const depth = difficulty === "hard" ? 2 : 3;
  const actions: Action[] = [
    ...moves.map((to) => ({ type: "move" as const, to })),
    ...candidateWalls(s, me, wallLimit).map((wall) => ({ type: "wall" as const, wall })),
  ];
  return search(s, me, depth, actions).action;
}

export const DIFFICULTIES: { id: Difficulty; emoji: string; name: string; desc: string }[] = [
  { id: "easy", emoji: "🙂", name: "Easy", desc: "For your first games" },
  { id: "normal", emoji: "😎", name: "Normal", desc: "Solid resistance" },
  { id: "hard", emoji: "🔥", name: "Hard", desc: "You will have to think" },
  { id: "hardcore", emoji: "💀", name: "Hardcore", desc: "No mercy 💀" },
];
