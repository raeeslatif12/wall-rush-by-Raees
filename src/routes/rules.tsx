import { createFileRoute } from "@tanstack/react-router";
import AppShell, { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "How to play WallRush — Quoridor rules" },
      {
        name: "description",
        content:
          "The full WallRush rules: move your pawn one square, place walls to lengthen your opponent's path, and never block someone off completely.",
      },
      { property: "og:title", content: "How to play WallRush — Quoridor rules" },
      { property: "og:description", content: "Learn Quoridor in two minutes: moves, walls, jumps and the no-blocking rule." },
    ],
  }),
  component: Rules,
});

const SECTIONS = [
  {
    title: "The goal",
    body: "You start on your own baseline of a 9×9 board. Reach any square on the opposite side before your opponent reaches theirs and you win.",
  },
  {
    title: "Your turn",
    body: "Each turn you do exactly one thing: move your pawn one square (up, down, left or right), or place one of your walls.",
  },
  {
    title: "Walls",
    body: "You get ten walls. A wall is two squares long and sits between rows or columns. Walls cannot be jumped over — they can only be walked around, and once placed they never move.",
  },
  {
    title: "The no-blocking rule",
    body: "A wall may never fully close off a player. After every wall there must still be at least one path to the goal for both pawns. Illegal spots simply cannot be tapped.",
  },
  {
    title: "Face to face",
    body: "If the two pawns end up next to each other, you may jump straight over the opponent. If a wall sits directly behind them, you step diagonally around them instead.",
  },
  {
    title: "Clock",
    body: "Online matches give each player five minutes. Run out of time and the match goes to your opponent.",
  },
  {
    title: "Points",
    body: "Ranked wins against real players give +25 points, a loss costs 8. Practice against the AI is free — it never touches your rating.",
  },
];

function Rules() {
  return (
    <AppShell>
      <PageHeader title="How to play" subtitle="Quoridor, in two minutes" />
      <div className="mx-auto w-full max-w-md space-y-3 px-4 pb-6">
        {SECTIONS.map((s) => (
          <article key={s.title} className="card-surface p-4">
            <h2 className="font-extrabold">{s.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
