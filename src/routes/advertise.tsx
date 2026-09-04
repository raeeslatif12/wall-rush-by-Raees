import { createFileRoute } from "@tanstack/react-router";
import AppShell, { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/advertise")({
  head: () => ({
    meta: [
      { title: "Advertise on WallRush — reach board game players" },
      {
        name: "description",
        content:
          "Promote your brand to WallRush players: banner placements, sponsored rooms and social shoutouts. Get in touch for rates.",
      },
      { property: "og:title", content: "Advertise on WallRush" },
      { property: "og:description", content: "Banner spots, sponsored rooms and social shoutouts for brands." },
    ],
  }),
  component: Advertise,
});

const SPOTS = [
  { emoji: "🖼️", title: "Home banner", text: "A single tasteful placement on the home screen, seen by every player." },
  { emoji: "🏟️", title: "Sponsored rooms", text: "Your name and logo on a themed public room lobby." },
  { emoji: "📱", title: "Social shoutout", text: "A post across our Instagram, TikTok, Telegram and YouTube channels." },
];

function Advertise() {
  return (
    <AppShell>
      <PageHeader title="Advertise" subtitle="Partner with WallRush" />
      <div className="mx-auto w-full max-w-md space-y-3 px-4 pb-8">
        <div className="card-surface p-4">
          <p className="text-sm font-bold">Who plays WallRush</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Strategy and board game fans playing quick 1v1 matches on mobile. Sessions are short, repeat visits
            are high, and there are no competing ad networks fighting for attention.
          </p>
        </div>

        {SPOTS.map((s) => (
          <div key={s.title} className="card-surface flex items-start gap-3 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-lg">
              {s.emoji}
            </span>
            <div>
              <p className="text-sm font-bold">{s.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.text}</p>
            </div>
          </div>
        ))}

        <div className="card-surface p-4">
          <p className="text-sm font-bold">Get rates</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us your product, budget and dates — we reply within a day.
          </p>
          <a
            href="https://t.me/wall_rush1"
            target="_blank"
            rel="noreferrer"
            className="mt-3 block rounded-xl bg-primary px-4 py-3 text-center text-sm font-extrabold text-primary-foreground"
          >
            Contact on Telegram
          </a>
        </div>
      </div>
    </AppShell>
  );
}
