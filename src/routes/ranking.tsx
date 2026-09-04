import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import AppShell, { PageHeader } from "@/components/AppShell";
import { useApp } from "@/hooks/useAppState";
import { api } from "@/lib/api";
import { rankFor } from "@/lib/local";

interface Row {
  id: string;
  username: string;
  points: number;
  wins: number;
  games: number;
}

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — top WallRush players" },
      {
        name: "description",
        content: "See the top WallRush players by points, wins and win rate. Climb the leaderboard one match at a time.",
      },
      { property: "og:title", content: "WallRush ranking" },
      { property: "og:description", content: "The global WallRush leaderboard: points, wins and win rate." },
    ],
  }),
  component: Ranking,
});

function Ranking() {
  const app = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.ranking()
      .then(({ rows: data }) => {
        setRows(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const myRank = rankFor(app.points).current;

  return (
    <AppShell>
      <PageHeader title="Ranking" subtitle="Top 50 players" />
      <div className="mx-auto w-full max-w-md px-4 pb-8">
        <div className="card-surface flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-xl">
            🏅
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{app.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {myRank.name} · {app.stats.wins}W / {app.stats.losses}L
            </p>
          </div>
          <p className="text-lg font-black">{app.points}</p>
        </div>

        <h2 className="mt-6 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
          Leaderboard
        </h2>
        <div className="mt-2 space-y-2">
          {loading && <p className="card-surface p-4 text-sm text-muted-foreground">Loading ranking…</p>}
          {!loading && rows.length === 0 && (
            <p className="card-surface p-4 text-sm text-muted-foreground">
              No ranked players yet. Win an online match to be the first on the board.
            </p>
          )}
          {rows.map((r, i) => {
            const rank = rankFor(r.points).current;
            return (
              <div key={r.id} className="card-surface flex items-center gap-3 p-3">
                <span className="w-6 text-center text-sm font-black text-muted-foreground">{i + 1}</span>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-base">🏅</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{r.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {rank.name} · {r.wins}W of {r.games}
                  </p>
                </div>
                <p className="text-sm font-black">{r.points}</p>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
