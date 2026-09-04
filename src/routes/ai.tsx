import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import AppShell, { PageHeader } from "@/components/AppShell";
import GameView from "@/components/GameView";
import { DIFFICULTIES, chooseAction, type Difficulty } from "@/lib/ai";
import { applyMove, applyWall, initialState, type GameState, type Pos, type Wall } from "@/lib/quoridor";
import { useApp } from "@/hooks/useAppState";
import { beep, vibrate } from "@/lib/local";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "Vs AI — practice WallRush offline" },
      {
        name: "description",
        content: "Practice WallRush against four AI levels, from Easy to Hardcore. Works even with no connection.",
      },
      { property: "og:title", content: "Vs AI — practice WallRush" },
      { property: "og:description", content: "Four AI levels: Easy, Normal, Hard and Hardcore. Practice never affects your rating." },
    ],
  }),
  component: VsAI,
});

function VsAI() {
  const app = useApp();
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [state, setState] = useState<GameState>(() => initialState());
  const [thinking, setThinking] = useState(false);
  const [resigned, setResigned] = useState(false);
  const recorded = useRef(false);

  const reset = useCallback(() => {
    setState(initialState());
    setResigned(false);
    recorded.current = false;
  }, []);

  useEffect(() => {
    if (!difficulty || state.turn !== 1 || state.winner !== null || resigned) return;
    setThinking(true);
    const t = setTimeout(() => {
      setState((prev) => {
        if (prev.turn !== 1 || prev.winner !== null) return prev;
        const action = chooseAction(prev, 1, difficulty);
        return action.type === "move" ? applyMove(prev, action.to) : applyWall(prev, action.wall);
      });
      setThinking(false);
    }, 350);
    return () => clearTimeout(t);
  }, [difficulty, state, resigned]);

  useEffect(() => {
    if (recorded.current) return;
    if (state.winner === null && !resigned) return;
    recorded.current = true;
    void app.recordResult(state.winner === 0 && !resigned, {
      opponentType: "ai",
      opponentName: difficulty ?? "ai",
      ranked: false,
    });
  }, [state.winner, resigned, app, difficulty]);

  if (!difficulty) {
    return (
      <AppShell>
        <PageHeader title="Vs AI" subtitle="Pick your opponent" />
        <div className="mx-auto w-full max-w-md space-y-3 px-4">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                reset();
                setDifficulty(d.id);
              }}
              className="card-surface flex w-full items-center gap-3 p-4 text-left"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-xl">{d.emoji}</span>
              <span className="flex-1">
                <span className="block text-lg font-extrabold leading-tight">{d.name}</span>
                <span className="block text-sm text-muted-foreground">{d.desc}</span>
              </span>
              <span className="text-xl text-muted-foreground">›</span>
            </button>
          ))}
          <p className="px-1 pt-2 text-xs text-muted-foreground">
            Practice games never change your points — play as much as you like.
          </p>
        </div>
      </AppShell>
    );
  }

  const label = DIFFICULTIES.find((d) => d.id === difficulty)!;

  return (
    <GameView
      title={`Vs AI · ${label.name}`}
      state={state}
      mySeat={0}
      myName={app.displayName}
      oppName={`AI ${label.emoji} ${label.name}`}
      interactive={!resigned}
      clocks={null}
      {...(thinking ? { statusLine: "AI is thinking…" } : {})}
      resultOverride={resigned ? "You resigned" : null}
      onMove={(p: Pos) => {
        vibrate(app.settings.vibration);
        beep(app.settings.sound);
        setState((s) => applyMove(s, p));
      }}
      onWall={(w: Wall) => {
        vibrate(app.settings.vibration, 25);
        beep(app.settings.sound, 420);
        setState((s) => applyWall(s, w));
      }}
      onResign={() => setResigned(true)}
      onRematch={reset}
    />
  );
}
