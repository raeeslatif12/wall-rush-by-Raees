import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import AppShell, { PageHeader } from "@/components/AppShell";
import { useApp } from "@/hooks/useAppState";
import { api } from "@/lib/api";

interface Review {
  id: string;
  username: string;
  rating: number;
  comment: string | null;
  likes: number;
  created_at: string;
}

export const Route = createFileRoute("/reviews")({
  head: () => ({
    meta: [
      { title: "Reviews — what players say about WallRush" },
      {
        name: "description",
        content: "Read player reviews of WallRush, the free 1v1 Quoridor game, and leave your own rating.",
      },
      { property: "og:title", content: "WallRush reviews" },
      { property: "og:description", content: "Player ratings and comments about WallRush." },
    ],
  }),
  component: Reviews,
});

function Reviews() {
  const app = useApp();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.reviews().then(({ rows }) => setReviews(rows)).catch(() => setReviews([]));
  }

  useEffect(load, []);

  async function submit() {
    if (!app.user) return;
    setBusy(true);
    setError(null);
    try {
      await api.addReview({ rating, comment: comment.trim() || null });
      setComment("");
      load();
    } catch {
      setError("Could not post your review. Try again.");
    }
    setBusy(false);
  }

  const avg = reviews.length
    ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <AppShell>
      <PageHeader title="Reviews" subtitle={`${avg} average · ${reviews.length} reviews`} />
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-8">
        <div className="card-surface p-4">
          <p className="text-sm font-bold">Rate WallRush</p>
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} stars`}
                className={`text-2xl transition-transform ${n <= rating ? "" : "opacity-30"}`}
              >
                ⭐
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="What do you think of the game?"
            className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
          />
          {app.user ? (
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="mt-3 w-full rounded-xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Posting…" : "Post review"}
            </button>
          ) : (
            <Link
              to="/auth"
              className="mt-3 block rounded-xl bg-muted px-4 py-3 text-center text-sm font-extrabold"
            >
              Sign in to post a review
            </Link>
          )}
          {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
        </div>

        {reviews.map((r) => (
          <div key={r.id} className="card-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{r.username}</p>
              <p className="text-sm">{"⭐".repeat(r.rating)}</p>
            </div>
            {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
