const KEY = "wallrush:v1";

export interface GuestStats {
  points: number;
  games: number;
  wins: number;
  losses: number;
  streak: number;
  lastPlayed: string | null;
  dailyDate: string | null;
  dailyCount: number;
}

export interface Settings {
  sound: boolean;
  vibration: boolean;
  dark: boolean;
  lang: string;
}

export interface LocalData {
  token: string;
  name: string;
  stats: GuestStats;
  settings: Settings;
}

function makeToken() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function defaultData(): LocalData {
  return {
    token: makeToken(),
    name: "User" + Math.floor(1000 + Math.random() * 9000),
    stats: {
      points: 0,
      games: 0,
      wins: 0,
      losses: 0,
      streak: 0,
      lastPlayed: null,
      dailyDate: null,
      dailyCount: 0,
    },
    settings: { sound: true, vibration: true, dark: false, lang: "en" },
  };
}

export function loadLocal(): LocalData {
  if (typeof window === "undefined") return defaultData();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const d = defaultData();
      window.localStorage.setItem(KEY, JSON.stringify(d));
      return d;
    }
    const parsed = JSON.parse(raw) as Partial<LocalData>;
    const base = defaultData();
    return {
      token: parsed.token ?? base.token,
      name: parsed.name ?? base.name,
      stats: { ...base.stats, ...(parsed.stats ?? {}) },
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return defaultData();
  }
}

export function saveLocal(d: LocalData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(d));
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export const RANKS = [
  { name: "Rookie", at: 0 },
  { name: "Apprentice", at: 100 },
  { name: "Fighter", at: 300 },
  { name: "Strategist", at: 700 },
  { name: "Master", at: 1500 },
  { name: "Grandmaster", at: 3000 },
];

export function rankFor(points: number) {
  let current = RANKS[0]!;
  let next: { name: string; at: number } | null = null;
  for (const r of RANKS) {
    if (points >= r.at) current = r;
    else {
      next = r;
      break;
    }
  }
  return { current, next };
}

export function vibrate(enabled: boolean, ms = 15) {
  if (!enabled || typeof navigator === "undefined" || !navigator.vibrate) return;
  navigator.vibrate(ms);
}

let ctx: AudioContext | null = null;
export function beep(enabled: boolean, freq = 620, ms = 70) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "triangle";
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
  } catch {
    /* ignore */
  }
}
