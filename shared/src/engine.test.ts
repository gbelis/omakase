import { describe, expect, it } from "vitest";
import { Action, Sushi, type Card } from "./data/cards";
import { OmakaseEngine } from "./engine";
import { Phase, makeGameState } from "./gameState";
import { action, cards, sushi } from "./testUtils";

const belt = (): Card[] => [
  sushi(Sushi.TUNA, 100),
  sushi(Sushi.SALMON, 101),
  sushi(Sushi.SHRIMP, 102),
  sushi(Sushi.CRAB, 103),
  sushi(Sushi.CONGER_EEL, 104),
  sushi(Sushi.OCTOPUS, 105),
];

interface CraftOpts {
  phase?: Phase;
  currentPlayer?: number;
  hand0?: Card[];
  hand1?: Card[];
  belt?: Card[];
  deck?: Card[];
  choices?: { victimIdx?: number; victimCardIdx?: number; returnCardIdx?: number } | null;
}

function craft(opts: CraftOpts): OmakaseEngine {
  const env = new OmakaseEngine(2);
  const s = makeGameState(2);
  s.currentPlayer = opts.currentPlayer ?? 0;
  s.phase = opts.phase ?? Phase.PHASE_1;
  s.players[0].hand = opts.hand0 ?? [];
  s.players[1].hand = opts.hand1 ?? [];
  s.conveyorBelt = opts.belt ?? belt();
  s.deck = opts.deck ?? cards(Sushi.TOFU, Sushi.TUNA, Sushi.SALMON, Sushi.SHRIMP, Sushi.CRAB);
  env.state = s;
  env.setActionChoices(opts.choices ?? null);
  return env;
}

const kidsSet = (): Card[] => [
  sushi(Sushi.OMELETTE, 201),
  sushi(Sushi.TOFU, 202),
  sushi(Sushi.CUCUMBER_ROLL, 203),
  sushi(Sushi.KARAAGE, 204),
];

describe("setup", () => {
  it("deals one card each, six to the belt, and draws on turn start", () => {
    const env = new OmakaseEngine(2);
    env.reset(1234);
    // 62 - 2 dealt - 6 belt - 1 opening draw = 53
    expect(env.state.deck).toHaveLength(53);
    expect(env.state.players[0].hand).toHaveLength(2);
    expect(env.state.players[1].hand).toHaveLength(1);
    expect(env.state.conveyorBelt).toHaveLength(6);
    expect(env.state.phase).toBe(Phase.PHASE_1);
    expect(env.turnCount).toBe(0);
  });

  it("is deterministic for a given seed", () => {
    const a = new OmakaseEngine(2);
    const b = new OmakaseEngine(2);
    a.reset(42);
    b.reset(42);
    expect(a.state.deck.map((c) => c.cardId)).toEqual(b.state.deck.map((c) => c.cardId));
    expect(a.state.players[0].hand.map((c) => c.cardId)).toEqual(
      b.state.players[0].hand.map((c) => c.cardId),
    );
    expect(a.state.conveyorBelt.map((c) => c.cardId)).toEqual(
      b.state.conveyorBelt.map((c) => c.cardId),
    );
  });
});

describe("turn sequence", () => {
  it("runs action → exchange → action → check/end and passes the turn", () => {
    const env = craft({ phase: Phase.PHASE_1, hand0: [sushi(Sushi.TUNA, 1)] });
    env.step(0);
    expect(env.state.phase).toBe(Phase.PHASE_2);

    env.step(0 * 6 + 1); // Tuna (hand) ↔ Salmon (belt)
    expect(env.state.phase).toBe(Phase.PHASE_3);

    env.step(0);
    expect(env.state.phase).toBe(Phase.PHASE_4);

    env.step(0);
    expect(env.state.currentPlayer).toBe(1);
    expect(env.state.phase).toBe(Phase.PHASE_1);
    expect(env.turnCount).toBe(1);
  });

  it("shifts the belt after a turn", () => {
    const env = craft({ phase: Phase.PHASE_4 });
    const oldFirst = env.state.conveyorBelt[0]!.cardId;
    env.step(0);
    expect(env.state.conveyorBelt).toHaveLength(6);
    expect(env.state.conveyorBelt[0]!.cardId).not.toBe(oldFirst);
    expect(env.state.trash.length).toBeGreaterThan(0);
  });
});

describe("exchange restrictions", () => {
  it("forbids swapping two cards of the same sushi type", () => {
    const env = craft({ phase: Phase.PHASE_2, hand0: [sushi(Sushi.TUNA, 1)] });
    const legal = env.getLegalActions();
    expect(legal).not.toContain(0); // belt[0] is Tuna, same type
    expect(legal).toContain(1); // belt[1] is Salmon
  });

  it("forbids exchanging Ginger", () => {
    const env = craft({
      phase: Phase.PHASE_2,
      hand0: [action(Action.GINGER, 1), sushi(Sushi.TUNA, 2)],
    });
    const legal = env.getLegalActions();
    for (let b = 0; b < 6; b++) expect(legal).not.toContain(0 * 6 + b);
  });
});

describe("action cards", () => {
  it("Matcha raises the hand limit and draws a card", () => {
    const env = craft({
      phase: Phase.PHASE_1,
      hand0: [action(Action.MATCHA, 1)],
      deck: [sushi(Sushi.OCTOPUS, 900)],
    });
    env.step(1);
    expect(env.state.players[0].maxHandSize).toBe(9);
    expect(env.state.players[0].matchaCount).toBe(1);
    expect(env.state.players[0].hand.map((c) => (c.isSushi ? c.sushiCard : c.actionCard))).toContain(
      Sushi.OCTOPUS,
    );
    expect(env.state.phase).toBe(Phase.PHASE_2);
  });

  it("Chopsticks steals a random card", () => {
    const env = craft({
      phase: Phase.PHASE_1,
      hand0: [action(Action.CHOPSTICKS, 1)],
      hand1: [sushi(Sushi.OCTOPUS, 2)],
    });
    env.step(1);
    expect(env.state.players[0].hand.some((c) => c.isSushi && c.sushiCard === Sushi.OCTOPUS)).toBe(true);
    expect(env.state.players[1].hand).toHaveLength(0);
  });

  it("Sake steals then returns the chosen card", () => {
    const env = craft({
      phase: Phase.PHASE_1,
      hand0: [action(Action.SAKE, 1), sushi(Sushi.TUNA, 2)],
      hand1: [sushi(Sushi.OCTOPUS, 3)],
      choices: { victimCardIdx: 0, returnCardIdx: 0 },
    });
    env.step(1);
    const p0 = env.state.players[0].hand.map((c) => (c.isSushi ? c.sushiCard : c.actionCard));
    const p1 = env.state.players[1].hand.map((c) => (c.isSushi ? c.sushiCard : c.actionCard));
    expect(p0).toContain(Sushi.OCTOPUS);
    expect(p1).toContain(Sushi.TUNA);
  });

  it("Fork discards the opponent's most expensive sushi", () => {
    const env = craft({
      phase: Phase.PHASE_1,
      hand0: [action(Action.FORK, 1)],
      hand1: [sushi(Sushi.TOFU, 2), sushi(Sushi.OCTOPUS, 3), sushi(Sushi.SALMON, 4)],
    });
    env.step(1);
    expect(env.state.players[1].hand.some((c) => c.isSushi && c.sushiCard === Sushi.OCTOPUS)).toBe(false);
    expect(env.state.trash.some((c) => c.isSushi && c.sushiCard === Sushi.OCTOPUS)).toBe(true);
  });

  it("Fork skips a check-protected player", () => {
    const env = craft({
      phase: Phase.PHASE_1,
      hand0: [action(Action.FORK, 1)],
      hand1: [sushi(Sushi.OCTOPUS, 2)],
    });
    env.state.gameEnding = true;
    env.state.players[1].checkProtected = true;
    env.step(1);
    expect(env.state.players[1].hand).toHaveLength(1);
  });

  it("Chef's Choice draws 3 then returns 2 to chosen deck positions", () => {
    const env = craft({
      phase: Phase.PHASE_1,
      hand0: [action(Action.CHEFS_CHOICE, 1)],
      deck: [
        sushi(Sushi.TOFU, 900),
        sushi(Sushi.TUNA, 901),
        sushi(Sushi.SALMON, 902),
        sushi(Sushi.OCTOPUS, 903),
      ],
    });
    env.step(1);
    expect(env.state.phase).toBe(Phase.CHEFS_CHOICE_SELECT_CARDS);
    expect(env.state.chefChoiceDrawnCards).toHaveLength(3);
    expect(env.state.players[0].hand).toHaveLength(3);

    env.step(0);
    env.step(0);
    expect(env.state.phase).toBe(Phase.CHEFS_CHOICE_SELECT_POSITIONS);

    env.step(0);
    env.step(0);
    expect(env.state.phase).toBe(Phase.PHASE_2);
    expect(env.state.deck).toHaveLength(3);
    expect(env.state.players[0].hand).toHaveLength(1);
  });
});

describe("wasabi", () => {
  it("triggers on draw (flagging the next turn)", () => {
    const env = craft({
      phase: Phase.PHASE_4,
      currentPlayer: 0,
      deck: [
        sushi(Sushi.TOFU, 900),
        action(Action.WASABI, 901),
        sushi(Sushi.SALMON, 902),
        sushi(Sushi.SHRIMP, 903),
        sushi(Sushi.CRAB, 904),
      ],
    });
    env.step(0); // p0 ends; p1 draws Wasabi on turn start
    expect(env.state.players[1].wasabiSkipFlag).toBe(1);
    expect(env.state.wasabiEvents).toContainEqual({ type: "draw", playerIdx: 1 });
  });

  it("skips the flagged player's next turn", () => {
    const env = craft({
      phase: Phase.PHASE_4,
      currentPlayer: 1,
      deck: cards(Sushi.TOFU, Sushi.TUNA, Sushi.SALMON, Sushi.SHRIMP, Sushi.CRAB),
    });
    env.state.players[0].wasabiSkipFlag = 1;
    env.step(0); // p1 ends → p0's turn is skipped → p1 starts again
    expect(env.state.wasabiEvents).toContainEqual({ type: "skip", playerIdx: 0 });
    expect(env.state.currentPlayer).toBe(1);
    expect(env.turnCount).toBe(2);
  });
});

describe("check & game end", () => {
  it("gives each opponent one final turn, then ends the game", () => {
    const env = craft({
      phase: Phase.PHASE_4,
      currentPlayer: 0,
      hand0: kidsSet(),
      deck: cards(Sushi.TOFU, Sushi.TUNA, Sushi.SALMON, Sushi.SHRIMP, Sushi.CRAB),
    });
    env.step(1); // call check
    expect(env.state.gameEnding).toBe(true);
    expect(env.state.players[0].checkProtected).toBe(true);
    expect(env.state.players[0].hasCalledCheck).toBe(true);
    expect(env.state.currentPlayer).toBe(1);

    env.state.phase = Phase.PHASE_4;
    env.step(0); // p1 final turn
    expect(env.state.gameOver).toBe(true);
  });

  it("ends immediately when the deck is exhausted", () => {
    const env = craft({ phase: Phase.PHASE_4, currentPlayer: 0, deck: [] });
    env.step(0);
    expect(env.state.gameOver).toBe(true);
  });

  it("scores both hands at the end", () => {
    const env = craft({
      phase: Phase.PHASE_4,
      hand0: kidsSet(),
      hand1: [sushi(Sushi.OCTOPUS, 300), sushi(Sushi.TUNA, 301)],
    });
    const results = env.getGameResults();
    expect(results[0]).toBe(2000);
    expect(results[1]).toBe(1500);
  });
});
