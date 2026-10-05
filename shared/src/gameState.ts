import type { Card } from "./data/cards";

export const Phase = {
  PHASE_1: 0,
  PHASE_2: 1,
  PHASE_3: 2,
  PHASE_4: 3,
  CHEFS_CHOICE_SELECT_CARDS: 4,
  CHEFS_CHOICE_SELECT_POSITIONS: 5,
  PHASE_DISCARD: 6,
} as const;

export type Phase = (typeof Phase)[keyof typeof Phase];

export const PHASE_NAMES: Record<Phase, string> = {
  [Phase.PHASE_1]: "PHASE_1",
  [Phase.PHASE_2]: "PHASE_2",
  [Phase.PHASE_3]: "PHASE_3",
  [Phase.PHASE_4]: "PHASE_4",
  [Phase.CHEFS_CHOICE_SELECT_CARDS]: "CHEFS_CHOICE_SELECT_CARDS",
  [Phase.CHEFS_CHOICE_SELECT_POSITIONS]: "CHEFS_CHOICE_SELECT_POSITIONS",
  [Phase.PHASE_DISCARD]: "PHASE_DISCARD",
};

export interface PlayerState {
  hand: Card[];
  maxHandSize: number;
  matchaCount: number;
  wasabiSkipFlag: number;
  checkProtected: boolean;
  hasCalledCheck: boolean;
}

export interface WasabiEvent {
  type: "draw" | "skip";
  playerIdx: number;
}

export interface GameState {
  numPlayers: number;
  currentPlayer: number;
  phase: Phase;
  players: PlayerState[];
  conveyorBelt: Card[];
  deck: Card[];
  trash: Card[];
  actionPlayedThisTurn: boolean;
  gameEnding: boolean;
  gameOver: boolean;
  chefChoiceDrawnCards: Card[];
  chefChoiceSelectedCards: Card[];
  chefChoiceSelectedPositions: number[];
  chefChoiceReturnPhase: Phase;
  wasabiEvents: WasabiEvent[];
}

export function makePlayerState(): PlayerState {
  return {
    hand: [],
    maxHandSize: 8,
    matchaCount: 0,
    wasabiSkipFlag: 0,
    checkProtected: false,
    hasCalledCheck: false,
  };
}

export function makeGameState(numPlayers: number): GameState {
  return {
    numPlayers,
    currentPlayer: 0,
    phase: Phase.PHASE_1,
    players: Array.from({ length: numPlayers }, makePlayerState),
    conveyorBelt: [],
    deck: [],
    trash: [],
    actionPlayedThisTurn: false,
    gameEnding: false,
    gameOver: false,
    chefChoiceDrawnCards: [],
    chefChoiceSelectedCards: [],
    chefChoiceSelectedPositions: [],
    chefChoiceReturnPhase: Phase.PHASE_2,
    wasabiEvents: [],
  };
}

export function copyState(state: GameState): GameState {
  return structuredClone(state);
}
