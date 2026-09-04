import { createFileRoute } from "@tanstack/react-router";
import AppShell, { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support WallRush — keep the game free" },
      {
        name: "description",
        content:
          "WallRush is free with no forced ads. Support the project by sharing it, following us, or sending feedback.",
      },
      { property: "og:title", content: "Support WallRush" },
      { property: "og:description", content: "Help keep WallRush free for everyone." },
    ],
  }),
  component: Support,
});

const WAYS = [
  {
    emoji: "📤",
    title: "Share the game",
    text: "Send wallrush.online to one friend who likes board games. That is the single biggest help.",
  },
  {
    emoji: "⭐",
    title: "Leave a review",
    text: "Ratings help new players trust the game before their first match.",
  },
  {
    emoji: "🐞",
    title: "Report a bug",
    text: "Found something broken or unfair? Message us on Telegram and we'll fix it fast.",
  },
  {
    emoji: "📣",
    title: "Follow the socials",
    text: "Instagram, TikTok, Telegram and YouTube — updates, tips and tournaments.",
  },
];

function Support() {
  return (
    <AppShell>
      <PageHeader title="Support" subtitle="Keep WallRush free" />
      <div className="mx-auto w-full max-w-md space-y-3 px-4 pb-8">
        <div className="card-surface p-4">
          <p className="text-sm font-bold">Why support?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            WallRush has no signup wall, no paywall and no forced ads. Servers and development are covered by
            players who spread the word.
          </p>
        </div>

        {WAYS.map((w) => (
          <div key={w.title} className="card-surface flex items-start gap-3 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-lg">
              {w.emoji}
            </span>
            <div>
              <p className="text-sm font-bold">{w.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{w.text}</p>
            </div>
          </div>
        ))}

        <a
          href="https://t.me/wall_rush1"
          target="_blank"
          rel="noreferrer"
          className="block rounded-2xl bg-primary px-4 py-3.5 text-center text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-raised)]"
        >
          Message us on Telegram
        </a>
      </div>
    </AppShell>
  );
}
