import type { Card } from "./data/cards";
import { Phase, type GameState, type WasabiEvent } from "./gameState";

export interface PlayerPublicState {
  handCount: number;
  maxHandSize: number;
  matchaCount: number;
  wasabiSkipFlag: number;
  checkProtected: boolean;
  hasCalledCheck: boolean;
  /** Only populated for the viewing seat. */
  hand?: Card[];
}

export interface ChefsChoiceView {
  drawnNames: string[];
  selectedCount: number;
  selectedPositions: number;
  deckPositions: number;
}

export interface PlayerView {
  you: number;
  rev: number;
  numPlayers: number;
  currentPlayer: number;
  phase: Phase;
  actionPlayedThisTurn: boolean;
  gameEnding: boolean;
  gameOver: boolean;
  conveyorBelt: Card[];
  deckCount: number;
  trash: Card[];
  players: PlayerPublicState[];
  legalActions: number[];
  wasabiEvents: WasabiEvent[];
  chefsChoice?: ChefsChoiceView;
}

/**
 * Produce the per-seat redacted view. Opponent hands and deck order are never
 * leaked; only counts are exposed. The viewer sees their own full hand.
 */
export function redact(
  state: GameState,
  seat: number,
  legalActions: number[] = [],
  rev = 0,
): PlayerView {
  const players: PlayerPublicState[] = state.players.map((p, idx) => {
    const base: PlayerPublicState = {
      handCount: p.hand.length,
      maxHandSize: p.maxHandSize,
      matchaCount: p.matchaCount,
      wasabiSkipFlag: p.wasabiSkipFlag,
      checkProtected: p.checkProtected,
      hasCalledCheck: p.hasCalledCheck,
    };
    if (idx === seat) base.hand = p.hand;
    return base;
  });

  const view: PlayerView = {
    you: seat,
    rev,
    numPlayers: state.numPlayers,
    currentPlayer: state.currentPlayer,
    phase: state.phase,
    actionPlayedThisTurn: state.actionPlayedThisTurn,
    gameEnding: state.gameEnding,
    gameOver: state.gameOver,
    conveyorBelt: state.conveyorBelt,
    deckCount: state.deck.length,
    trash: state.trash,
    players,
    legalActions,
    wasabiEvents: state.wasabiEvents,
  };

  if (
    state.phase === Phase.CHEFS_CHOICE_SELECT_CARDS ||
    state.phase === Phase.CHEFS_CHOICE_SELECT_POSITIONS
  ) {
    view.chefsChoice = {
      drawnNames: state.chefChoiceDrawnCards.map((c) =>
        c.isSushi ? c.sushiCard : c.actionCard,
      ),
      selectedCount: state.chefChoiceSelectedCards.length,
      selectedPositions: state.chefChoiceSelectedPositions.length,
      deckPositions: state.deck.length + 1,
    };
  }

  return view;
}
