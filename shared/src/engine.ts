import {
  Action,
  CARD_VALUES,
  PASSIVE_ACTION_CARDS,
  createDeck,
  type ActionName,
  type Card,
} from "./data/cards";
import { Phase, copyState, makeGameState, makePlayerState, type GameState, type PlayerState } from "./gameState";
import { mulberry32, randomChoice, shuffleArray, type Rng } from "./rng";
import { calculateScore, hasValidSet } from "./scoring";

export const MAX_BELT_SIZE = 6;

/** Player-supplied targets consumed by the next action-card play. */
export interface ActionChoices {
  victimIdx?: number;
  victimCardIdx?: number;
  returnCardIdx?: number;
}

/**
 * Authoritative, deterministic Omakase game engine for 2+ players.
 *
 * This is a faithful TypeScript port of the original digital implementation's
 * turn engine: draw-on-turn-start, two optional action windows, mandatory belt
 * exchange, conveyor shift, hand-limit discard, and check/final-turn resolution.
 */
export class OmakaseEngine {
  readonly numPlayers: number;
  state!: GameState;
  turnCount = 0;
  private rng: Rng = Math.random;
  private nextActionChoices: ActionChoices | null = null;

  constructor(numPlayers = 2) {
    this.numPlayers = numPlayers;
  }

  reset(seed: number | null = null): void {
    this.rng = seed != null ? mulberry32(seed) : Math.random.bind(Math);
    const deck = createDeck();
    shuffleArray(deck, this.rng);

    const state = makeGameState(this.numPlayers);
    for (let i = 0; i < this.numPlayers; i++) {
      state.players[i].hand.push(deck.pop()!);
    }
    for (let i = 0; i < MAX_BELT_SIZE; i++) {
      state.conveyorBelt.push(deck.pop()!);
    }
    state.deck = deck;
    this.state = state;
    this.turnCount = 0;
    this.nextActionChoices = null;
    this.handleTurnStart();
  }

  /** Deep-copies the engine (used by simulations); RNG is shared. */
  copy(): OmakaseEngine {
    const env = new OmakaseEngine(this.numPlayers);
    env.state = copyState(this.state);
    env.turnCount = this.turnCount;
    env.rng = this.rng;
    return env;
  }

  /** Provide targets for the next action-card resolution (human picks). */
  setActionChoices(choices: ActionChoices | null): void {
    this.nextActionChoices = choices;
  }

  getActivePlayer(): PlayerState {
    return this.state.players[this.state.currentPlayer];
  }

  getGameResults(): Record<number, number> {
    const scores: Record<number, number> = {};
    for (let i = 0; i < this.numPlayers; i++) {
      scores[i] = calculateScore(this.state.players[i].hand);
    }
    return scores;
  }

  /**
   * Encoded legal actions, mirroring the original engine:
   * - PHASE_1/PHASE_3: 0 = skip, i+1 = play i-th playable action card
   * - PHASE_2: hIdx * MAX_BELT_SIZE + bIdx, or [0] when no exchange is legal
   * - PHASE_4: 0 = end turn, 1 = call check
   * - CHEFS_CHOICE_SELECT_CARDS / PHASE_DISCARD: hand indices
   * - CHEFS_CHOICE_SELECT_POSITIONS: deck insertion positions
   */
  getLegalActions(): number[] {
    const { state } = this;
    const player = state.players[state.currentPlayer];

    if (state.phase === Phase.PHASE_1) {
      const actions = [0];
      const playable = player.hand.filter(
        (c) => !c.isSushi && !PASSIVE_ACTION_CARDS.has(c.actionCard),
      );
      for (let i = 0; i < playable.length; i++) actions.push(i + 1);
      return actions;
    }

    if (state.phase === Phase.PHASE_2) {
      const actions: number[] = [];
      for (let hIdx = 0; hIdx < player.hand.length; hIdx++) {
        const hCard = player.hand[hIdx];
        if (!hCard.isSushi && hCard.actionCard === Action.GINGER) continue;
        for (let bIdx = 0; bIdx < state.conveyorBelt.length; bIdx++) {
          const bCard = state.conveyorBelt[bIdx];
          if (hCard.cardId === bCard.cardId) continue;
          if (hCard.isSushi && bCard.isSushi && hCard.sushiCard === bCard.sushiCard) continue;
          if (!hCard.isSushi && !bCard.isSushi && hCard.actionCard === bCard.actionCard) continue;
          actions.push(hIdx * MAX_BELT_SIZE + bIdx);
        }
      }
      return actions.length > 0 ? actions : [0];
    }

    if (state.phase === Phase.PHASE_3) {
      if (state.actionPlayedThisTurn) return [0];
      const actions = [0];
      const playable = player.hand.filter(
        (c) => !c.isSushi && !PASSIVE_ACTION_CARDS.has(c.actionCard),
      );
      for (let i = 0; i < playable.length; i++) actions.push(i + 1);
      return actions;
    }

    if (state.phase === Phase.PHASE_4) {
      const actions = [0];
      if (this.canCallCheck(state.currentPlayer)) actions.push(1);
      return actions;
    }

    if (state.phase === Phase.CHEFS_CHOICE_SELECT_CARDS) {
      const actions = player.hand.map((_, i) => i);
      return actions.length > 0 ? actions : [0];
    }

    if (state.phase === Phase.CHEFS_CHOICE_SELECT_POSITIONS) {
      return Array.from({ length: state.deck.length + 1 }, (_, i) => i);
    }

    if (state.phase === Phase.PHASE_DISCARD) {
      return player.hand.map((_, i) => i);
    }

    return [0];
  }

  step(action: number): void {
    if (this.state.gameOver) return;
    const { phase } = this.state;
    if (phase === Phase.PHASE_1) this.handlePhase1(action);
    else if (phase === Phase.PHASE_2) this.handlePhase2(action);
    else if (phase === Phase.PHASE_3) this.handlePhase3(action);
    else if (phase === Phase.PHASE_4) this.handlePhase4(action);
    else if (phase === Phase.CHEFS_CHOICE_SELECT_CARDS) this.handleChefsChoiceSelectCards(action);
    else if (phase === Phase.CHEFS_CHOICE_SELECT_POSITIONS) this.handleChefsChoiceSelectPositions(action);
    else if (phase === Phase.PHASE_DISCARD) this.handlePhaseDiscard(action);
  }

  // ── Phase handlers ────────────────────────────────────────────────────────

  private handlePhase1(action: number): void {
    const { state } = this;
    const player = state.players[state.currentPlayer];
    const playable = player.hand.filter(
      (c) => !c.isSushi && !PASSIVE_ACTION_CARDS.has(c.actionCard),
    );

    if (action === 0) {
      state.phase = Phase.PHASE_2;
      return;
    }
    const idx = action - 1;
    const card = playable[idx];
    if (idx < playable.length && card && !card.isSushi) {
      const wasChefs = card.actionCard === Action.CHEFS_CHOICE;
      if (this.playActionCard(state.currentPlayer, card.actionCard)) {
        state.actionPlayedThisTurn = true;
        if (wasChefs) {
          state.phase = Phase.CHEFS_CHOICE_SELECT_CARDS;
          state.chefChoiceSelectedCards = [];
          state.chefChoiceSelectedPositions = [];
          state.chefChoiceReturnPhase = Phase.PHASE_2;
        } else {
          state.phase = Phase.PHASE_2;
        }
      }
    }
  }

  private handlePhase2(action: number): void {
    const { state } = this;
    if (state.conveyorBelt.length === 0) {
      state.phase = Phase.PHASE_3;
      return;
    }

    const hIdx = Math.floor(action / MAX_BELT_SIZE);
    const bIdx = action % MAX_BELT_SIZE;

    if (this.exchangeCard(state.currentPlayer, hIdx, bIdx)) {
      state.phase = Phase.PHASE_3;
      return;
    }

    const player = state.players[state.currentPlayer];
    outer: for (let hi = 0; hi < player.hand.length; hi++) {
      for (let bi = 0; bi < state.conveyorBelt.length; bi++) {
        if (this.exchangeCard(state.currentPlayer, hi, bi)) {
          state.phase = Phase.PHASE_3;
          break outer;
        }
      }
    }
    if (state.phase !== Phase.PHASE_3) state.phase = Phase.PHASE_3;
  }

  private handlePhase3(action: number): void {
    const { state } = this;
    if (state.actionPlayedThisTurn) {
      state.phase = Phase.PHASE_4;
      return;
    }

    const player = state.players[state.currentPlayer];
    const playable = player.hand.filter(
      (c) => !c.isSushi && !PASSIVE_ACTION_CARDS.has(c.actionCard),
    );

    if (action === 0) {
      state.phase = Phase.PHASE_4;
      return;
    }
    const idx = action - 1;
    const card = playable[idx];
    if (idx < playable.length && card && !card.isSushi) {
      const wasChefs = card.actionCard === Action.CHEFS_CHOICE;
      if (this.playActionCard(state.currentPlayer, card.actionCard)) {
        state.actionPlayedThisTurn = true;
        if (wasChefs) {
          state.phase = Phase.CHEFS_CHOICE_SELECT_CARDS;
          state.chefChoiceSelectedCards = [];
          state.chefChoiceSelectedPositions = [];
          state.chefChoiceReturnPhase = Phase.PHASE_4;
        } else {
          state.phase = Phase.PHASE_4;
        }
      }
    }
  }

  private handlePhase4(action: number): void {
    const player = this.state.players[this.state.currentPlayer];
    if (action === 1 && this.canCallCheck(this.state.currentPlayer)) {
      player.hasCalledCheck = true;
      player.checkProtected = true;
      this.state.gameEnding = true;
    }
    this.endTurn();
  }

  private handleChefsChoiceSelectCards(action: number): void {
    const { state } = this;
    const player = state.players[state.currentPlayer];
    if (action < player.hand.length) {
      const selected = player.hand[action];
      player.hand.splice(action, 1);
      state.chefChoiceSelectedCards.push(selected);
    }
    if (state.chefChoiceSelectedCards.length === 2) {
      state.phase = Phase.CHEFS_CHOICE_SELECT_POSITIONS;
    }
  }

  private handleChefsChoiceSelectPositions(action: number): void {
    const { state } = this;
    if (action <= state.deck.length) {
      state.chefChoiceSelectedPositions.push(action);
    }
    if (state.chefChoiceSelectedPositions.length === 2) {
      const cards = state.chefChoiceSelectedCards;
      const positions = state.chefChoiceSelectedPositions;
      const paired = positions.map((p, i) => [p, cards[i]] as const).sort((a, b) => b[0] - a[0]);
      for (const [pos, card] of paired) {
        state.deck.splice(pos, 0, card);
      }
      state.chefChoiceDrawnCards = [];
      state.chefChoiceSelectedCards = [];
      state.chefChoiceSelectedPositions = [];
      state.phase = state.chefChoiceReturnPhase;
    }
  }

  private handlePhaseDiscard(action: number): void {
    const { state } = this;
    const player = state.players[state.currentPlayer];
    if (action >= 0 && action < player.hand.length) {
      state.trash.push(player.hand.splice(action, 1)[0]);
    }
    if (player.hand.length > player.maxHandSize) return;
    this.proceedToNextTurn();
  }

  // ── Turn lifecycle ─────────────────────────────────────────────────────────

  private endTurn(): void {
    const { state } = this;
    this.moveConveyor();
    if (state.gameOver) return;

    const player = state.players[state.currentPlayer];
    if (player.hand.length > player.maxHandSize) {
      state.phase = Phase.PHASE_DISCARD;
      return;
    }
    this.proceedToNextTurn();
  }

  private proceedToNextTurn(): void {
    const { state } = this;
    if (state.gameOver) return;

    this.turnCount++;
    const nextPlayer = (state.currentPlayer + 1) % state.numPlayers;

    if (state.gameEnding && state.players[nextPlayer].hasCalledCheck) {
      state.gameOver = true;
      return;
    }

    state.currentPlayer = nextPlayer;
    state.phase = Phase.PHASE_1;
    state.actionPlayedThisTurn = false;
    this.handleTurnStart();
  }

  private handleTurnStart(): void {
    const { state } = this;
    const player = state.players[state.currentPlayer];

    if (player.wasabiSkipFlag > 0) {
      player.wasabiSkipFlag--;
      state.wasabiEvents.push({ type: "skip", playerIdx: state.currentPlayer });
      this.endTurn();
      return;
    }

    const card = this.drawFromDeck();
    if (!card) return;

    if (!card.isSushi && card.actionCard === Action.WASABI) {
      player.wasabiSkipFlag++;
      state.wasabiEvents.push({ type: "draw", playerIdx: state.currentPlayer });
    }
    player.hand.push(card);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private drawFromDeck(): Card | null {
    const { state } = this;
    if (state.deck.length === 0) {
      state.gameOver = true;
      return null;
    }
    return state.deck.shift()!;
  }

  private moveConveyor(): void {
    const { state } = this;
    if (state.conveyorBelt.length > 0) {
      state.trash.push(state.conveyorBelt.pop()!);
    }
    const card = this.drawFromDeck();
    if (card) state.conveyorBelt.unshift(card);
  }

  private canCallCheck(playerIdx: number): boolean {
    const player = this.state.players[playerIdx];
    if (player.hasCalledCheck) return false;
    return hasValidSet(player.hand);
  }

  private exchangeCard(playerIdx: number, hIdx: number, bIdx: number): boolean {
    const { state } = this;
    const player = state.players[playerIdx];
    if (hIdx < 0 || hIdx >= player.hand.length) return false;
    if (bIdx < 0 || bIdx >= state.conveyorBelt.length) return false;

    const hCard = player.hand[hIdx];
    const bCard = state.conveyorBelt[bIdx];

    if (!hCard.isSushi && hCard.actionCard === Action.GINGER) return false;
    if (hCard.cardId === bCard.cardId) return false;
    if (hCard.isSushi && bCard.isSushi && hCard.sushiCard === bCard.sushiCard) return false;
    if (!hCard.isSushi && !bCard.isSushi && hCard.actionCard === bCard.actionCard) return false;

    player.hand[hIdx] = bCard;
    state.conveyorBelt[bIdx] = hCard;
    return true;
  }

  private playActionCard(playerIdx: number, actionCardType: ActionName): boolean {
    const { state } = this;
    const player = state.players[playerIdx];
    const choices = this.nextActionChoices ?? {};
    this.nextActionChoices = null;

    const cardIdx = player.hand.findIndex(
      (c) => !c.isSushi && c.actionCard === actionCardType,
    );
    if (cardIdx === -1) return false;
    if (PASSIVE_ACTION_CARDS.has(actionCardType)) return false;

    const card = player.hand[cardIdx];
    player.hand.splice(cardIdx, 1);
    state.trash.push(card);

    const opponents = Array.from({ length: state.numPlayers }, (_, i) => i).filter(
      (i) => i !== playerIdx,
    );

    if (actionCardType === Action.MATCHA) {
      player.matchaCount++;
      player.maxHandSize++;
      const drawn = this.drawFromDeck();
      if (drawn) {
        player.hand.push(drawn);
        if (!drawn.isSushi && drawn.actionCard === Action.WASABI) {
          player.wasabiSkipFlag++;
          state.wasabiEvents.push({ type: "draw", playerIdx });
        }
      }
      return true;
    }

    if (actionCardType === Action.CHOPSTICKS) {
      const victim = this.pickVictim(opponents, choices);
      if (victim != null) {
        const vp = state.players[victim];
        if (!vp.checkProtected && vp.hand.length > 0) {
          const stolen =
            choices.victimCardIdx != null && choices.victimCardIdx < vp.hand.length
              ? vp.hand[choices.victimCardIdx]
              : randomChoice(vp.hand, this.rng);
          vp.hand.splice(vp.hand.indexOf(stolen), 1);
          player.hand.push(stolen);
          this.triggerWasabiOnAcquire(player, stolen);
        }
      }
      return true;
    }

    if (actionCardType === Action.SAKE) {
      const victim = this.pickVictim(opponents, choices);
      if (victim != null) {
        const vp = state.players[victim];
        if (!vp.checkProtected && vp.hand.length > 0) {
          const stolen =
            choices.victimCardIdx != null && choices.victimCardIdx < vp.hand.length
              ? vp.hand[choices.victimCardIdx]
              : randomChoice(vp.hand, this.rng);
          vp.hand.splice(vp.hand.indexOf(stolen), 1);
          player.hand.push(stolen);
          // Matches original: Sake Wasabi acquisition flips the flag without an event.
          if (!stolen.isSushi && stolen.actionCard === Action.WASABI) player.wasabiSkipFlag++;
          if (player.hand.length > 0) {
            const returned =
              choices.returnCardIdx != null && choices.returnCardIdx < player.hand.length
                ? player.hand[choices.returnCardIdx]
                : randomChoice(player.hand, this.rng);
            player.hand.splice(player.hand.indexOf(returned), 1);
            vp.hand.push(returned);
            if (!returned.isSushi && returned.actionCard === Action.WASABI) vp.wasabiSkipFlag++;
          }
        }
      }
      return true;
    }

    if (actionCardType === Action.UMESHU) {
      const victim = this.pickVictim(opponents, choices);
      if (victim != null) {
        const vp = state.players[victim];
        if (vp.checkProtected) return true;
        const combined = [...player.hand, ...vp.hand];
        shuffleArray(combined, this.rng);
        player.hand = [];
        vp.hand = [];
        for (let i = 0; i < combined.length; i++) {
          const c = combined[i];
          if (i % 2 === 0) {
            player.hand.push(c);
            this.triggerWasabiOnAcquire(player, c);
          } else {
            vp.hand.push(c);
            this.triggerWasabiOnAcquire(vp, c);
          }
        }
      }
      return true;
    }

    if (actionCardType === Action.CHEFS_CHOICE) {
      const drawn: Card[] = [];
      for (let i = 0; i < 3; i++) {
        const c = this.drawFromDeck();
        if (c) {
          drawn.push(c);
          player.hand.push(c);
          this.triggerWasabiOnAcquire(player, c);
        }
      }
      state.chefChoiceDrawnCards = drawn;
      return true;
    }

    if (actionCardType === Action.FORK) {
      for (const victim of opponents) {
        const vp = state.players[victim];
        if (vp.checkProtected) continue;
        if (vp.hand.length > 0) {
          let target: Card;
          if (choices.victimCardIdx != null && choices.victimCardIdx < vp.hand.length) {
            target = vp.hand[choices.victimCardIdx];
          } else {
            const sushi = vp.hand.filter((c) => c.isSushi);
            if (sushi.length === 0) continue;
            target = sushi.reduce((a, b) =>
              (CARD_VALUES[a.sushiCard] ?? 0) >= (CARD_VALUES[b.sushiCard] ?? 0) ? a : b,
            );
          }
          vp.hand.splice(vp.hand.indexOf(target), 1);
          state.trash.push(target);
        }
      }
      return true;
    }

    return false;
  }

  private pickVictim(opponents: number[], choices: ActionChoices): number | null {
    if (opponents.length === 0) return null;
    if (choices.victimIdx != null && opponents.includes(choices.victimIdx)) {
      return choices.victimIdx;
    }
    return randomChoice(opponents, this.rng);
  }

  private triggerWasabiOnAcquire(target: PlayerState, card: Card): void {
    if (!card.isSushi && card.actionCard === Action.WASABI) {
      target.wasabiSkipFlag++;
      this.state.wasabiEvents.push({
        type: "draw",
        playerIdx: this.state.players.indexOf(target),
      });
    }
  }
}

export { MAX_BELT_SIZE as MAX_BELT };
export { makePlayerState };
