import type { ActionChoices } from "./engine";
import type { ScoreLine } from "./scoring";
import type { PlayerView } from "./view";

export interface GameOverPayload {
  results: Record<number, number>;
  winner: number | "tie";
  breakdown: Record<number, ScoreLine[]>;
}

export interface ServerToClientEvents {
  "server:hello": (payload: { ok: true }) => void;
  seated: (payload: { seat: number; numPlayers: number }) => void;
  state: (payload: PlayerView) => void;
  gameOver: (payload: GameOverPayload) => void;
  "room:waiting": () => void;
  opponent: (payload: { connected: boolean }) => void;
  error: (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  "game:step": (payload: { action: number; choices?: ActionChoices }) => void;
  "game:restart": () => void;
  "game:requestState": () => void;
}
