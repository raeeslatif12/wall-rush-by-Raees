import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import AppShell, { PageHeader } from "@/components/AppShell";
import { useApp } from "@/hooks/useAppState";
import { api } from "@/lib/api";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — save your WallRush progress" },
      {
        name: "description",
        content: "Create a free WallRush account to save your points, streak and match history across devices.",
      },
      { property: "og:title", content: "Sign in to WallRush" },
      { property: "og:description", content: "Save your points, streak and ranking across devices." },
    ],
  }),
  component: Auth,
});

function Auth() {
  const app = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(app.local.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (app.user) navigate({ to: "/profile" });
  }, [app.user, navigate]);

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        await api.signup(email, password, username.trim() || app.local.name);
        window.location.assign("/profile");
      } else {
        await api.login(email, password);
        window.location.assign("/profile");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError("Google sign-in requires a Google OAuth client configuration. Use email and password for now.");
  }

  return (
    <AppShell>
      <PageHeader title={mode === "signin" ? "Sign in" : "Create account"} subtitle="Save your progress" />
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-8">
        <div className="card-surface space-y-3 p-4">
          <button
            type="button"
            onClick={google}
            className="w-full rounded-xl bg-muted px-4 py-3 text-sm font-extrabold"
          >
            Continue with Google
          </button>

          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          {mode === "signup" && (
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:border-ring"
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:border-ring"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:border-ring"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !email || !password}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
          {notice && <p className="text-sm font-semibold text-success">{notice}</p>}

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-sm font-bold text-muted-foreground"
          >
            {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="px-1 text-xs text-muted-foreground">
          You can keep playing as a guest — signing in just saves your points, streak and ranking.
        </p>
      </div>
    </AppShell>
  );
}
