import { initialState, type GameState } from "./quoridor";
import { api } from "./api";

export interface RoomState {
  game: GameState;
  clocks: { base: [number, number]; lastMoveAt: number };
  emote?: { seat: 0 | 1; emoji: string; at: number } | null;
  rematch?: [boolean, boolean];
  resignedBy?: 0 | 1 | null;
}

export interface Room {
  id: string;
  code: string;
  is_public: boolean;
  status: string;
  p1_token: string | null;
  p1_name: string | null;
  p2_token: string | null;
  p2_name: string | null;
  is_bot: boolean;
  state: RoomState;
  winner: number | null;
  created_at: string;
  updated_at: string;
}

export const START_SECONDS = 300;

export function freshRoomState(): RoomState {
  return {
    game: initialState(),
    clocks: { base: [START_SECONDS, START_SECONDS], lastMoveAt: Date.now() },
    emote: null,
    rematch: [false, false],
    resignedBy: null,
  };
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function createRoom(opts: { isPublic: boolean; token: string; name: string }): Promise<Room> {
  return (await api.createRoom({ ...opts, state: freshRoomState() })).room;
}

export async function fetchRoom(code: string): Promise<Room | null> {
  return (await api.room(code)).room;
}

export async function joinRoom(code: string, token: string, name: string): Promise<Room> {
  return (await api.joinRoom(code, token, name)).room;
}

export async function listPublicRooms(): Promise<Room[]> {
  return (await api.rooms()).rooms;
}

export async function quickMatch(token: string, name: string): Promise<Room> {
  const open = await listPublicRooms();
  for (const r of open) {
    if (r.p1_token === token || r.p2_token) continue;
    try {
      return await joinRoom(r.code, token, name);
    } catch {
      continue;
    }
  }
  return createRoom({ isPublic: true, token, name });
}

export async function saveRoomState(
  code: string,
  token: string,
  state: RoomState,
  extra: { status?: string; winner?: number | null } = {},
) {
  await api.saveRoom(code, token, state, extra);
}

export async function saveRoomAction(
  code: string,
  token: string,
  action: Parameters<typeof api.roomAction>[2],
  expectedMoveCount: number,
): Promise<Room> {
  return (await api.roomAction(code, token, action, expectedMoveCount)).room;
}

export async function leaveRoom(code: string, token: string) {
  await api.leaveRoom(code, token);
}

export async function onlineCount(): Promise<number> {
  return (await api.onlineCount()).count;
}

export function seatOf(room: Room, token: string): 0 | 1 | null {
  if (room.p1_token === token) return 0;
  if (room.p2_token === token) return 1;
  return null;
}
