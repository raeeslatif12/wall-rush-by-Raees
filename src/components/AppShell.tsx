import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/ranking", label: "Ranking", icon: "🏆" },
  { to: "/profile", label: "Profile", icon: "👤" },
] as const;

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid-bg pb-24">
      {children}
      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-border bg-card/95 backdrop-blur">
        <ul className="flex">
          {NAV.map((n) => (
            <li key={n.to} className="flex-1">
              <Link
                to={n.to}
                className="flex flex-col items-center gap-0.5 py-2.5 text-xs font-bold text-muted-foreground"
                activeOptions={{ exact: n.to === "/" }}
                activeProps={{ className: "!text-primary" }}
              >
                <span className="text-lg leading-none">{n.icon}</span>
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mx-auto w-full max-w-md px-4 pb-2 pt-5">
      <Link to="/" className="text-xs font-bold text-muted-foreground">
        ← WallRush
      </Link>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
