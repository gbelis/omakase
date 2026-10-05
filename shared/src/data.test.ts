import { describe, expect, it } from "vitest";
import {
  ACTION_COUNTS,
  CARD_VALUES,
  SUSHI_COUNTS,
  Sushi,
  TOTAL_DECK_SIZE,
  cardName,
  cardValue,
  createDeck,
} from "./index";
import { action, sushi } from "./testUtils";

describe("deck composition", () => {
  it("contains 45 sushi + 17 action = 62 cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(TOTAL_DECK_SIZE);
    expect(deck.filter((c) => c.isSushi)).toHaveLength(45);
    expect(deck.filter((c) => !c.isSushi)).toHaveLength(17);
  });

  it("assigns unique card ids", () => {
    const deck = createDeck();
    expect(new Set(deck.map((c) => c.cardId)).size).toBe(deck.length);
  });

  it("matches the declared per-type counts", () => {
    const deck = createDeck();
    for (const [name, count] of SUSHI_COUNTS) {
      expect(deck.filter((c) => c.isSushi && c.sushiCard === name)).toHaveLength(count);
    }
    for (const [name, count] of ACTION_COUNTS) {
      expect(deck.filter((c) => !c.isSushi && c.actionCard === name)).toHaveLength(count);
    }
  });

  it("uses the printed yen values", () => {
    expect(CARD_VALUES[Sushi.ASSORTED_SASHIMI]).toBe(1500);
    expect(CARD_VALUES[Sushi.PREMIUM_EEL]).toBe(1200);
    expect(CARD_VALUES[Sushi.OCTOPUS]).toBe(1100);
    expect(CARD_VALUES[Sushi.FATTY_TUNA]).toBe(1000);
    expect(CARD_VALUES[Sushi.CONGER_EEL]).toBe(700);
    expect(CARD_VALUES[Sushi.CRAB]).toBe(600);
    expect(CARD_VALUES[Sushi.KARAAGE]).toBe(500);
    expect(CARD_VALUES[Sushi.TOFU]).toBe(200);
  });

  it("reports names and values via helpers", () => {
    expect(cardName(sushi(Sushi.TUNA))).toBe(Sushi.TUNA);
    expect(cardName(action("shoyu"))).toBe("shoyu");
    expect(cardValue(sushi(Sushi.OCTOPUS))).toBe(1100);
    expect(cardValue(action("shoyu"))).toBe(0);
  });
});
