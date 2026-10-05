import { describe, expect, it } from "vitest";
import { Sushi } from "./data/cards";
import { calculateScore, findOptimalSets, hasValidSet, scoreBreakdown } from "./scoring";
import { card } from "./testUtils";

describe("scoring — rulebook examples", () => {
  it("example 1: no completed set, sum of all sushi (4000)", () => {
    const hand = [
      card(Sushi.OCTOPUS),
      card(Sushi.CONGER_EEL),
      card(Sushi.CRAB),
      card(Sushi.TUNA),
      card(Sushi.TUNA),
      card(Sushi.SALMON_ROLL),
      card(Sushi.KARAAGE),
      card("umeshu"),
    ];
    expect(calculateScore(hand)).toBe(4000);
  });

  it("example 2: Omakase Set + Karaage doubled by Shoyu (7000)", () => {
    const hand = [
      card(Sushi.FATTY_TUNA),
      card(Sushi.CONGER_EEL),
      card(Sushi.CRAB),
      card(Sushi.TUNA),
      card(Sushi.SALMON_ROE),
      card(Sushi.SALMON),
      card(Sushi.KARAAGE),
      card("shoyu"),
      card("ginger"),
    ];
    expect(calculateScore(hand)).toBe(7000);
  });

  it("example 3: two Shoyu double the two priciest loose sushi (5500)", () => {
    const hand = [
      card(Sushi.ASSORTED_SASHIMI),
      card(Sushi.CONGER_EEL),
      card(Sushi.SALMON),
      card(Sushi.SHRIMP),
      card(Sushi.TUNA_ROLL),
      card("shoyu"),
      card("shoyu"),
    ];
    expect(calculateScore(hand)).toBe(5500);
  });

  it("example 4: Kids Set only, Shoyu has no eligible card (2000)", () => {
    const hand = [
      card(Sushi.OMELETTE),
      card(Sushi.TOFU),
      card(Sushi.CUCUMBER_ROLL),
      card(Sushi.KARAAGE),
      card("shoyu"),
    ];
    expect(calculateScore(hand)).toBe(2000);
  });
});

describe("set allocation", () => {
  it("cannot double-count a shared card across overlapping sets", () => {
    // Union of Omakase (6000) and Sakura (4500); they share Conger Eel/Crab/Tuna.
    const hand = [
      card(Sushi.FATTY_TUNA),
      card(Sushi.CONGER_EEL),
      card(Sushi.CRAB),
      card(Sushi.TUNA),
      card(Sushi.SALMON),
      card(Sushi.SALMON_ROE),
      card(Sushi.SHRIMP),
      card(Sushi.TUNA_ROLL),
      card(Sushi.SALMON_ROLL),
    ];
    const counts = { [Sushi.FATTY_TUNA]: 1, [Sushi.CONGER_EEL]: 1, [Sushi.CRAB]: 1, [Sushi.TUNA]: 1, [Sushi.SALMON]: 1, [Sushi.SALMON_ROE]: 1, [Sushi.SHRIMP]: 1, [Sushi.TUNA_ROLL]: 1, [Sushi.SALMON_ROLL]: 1 };
    // Only one of the overlapping sets can be claimed; Omakase (6000) wins.
    expect(findOptimalSets(counts).setsScore).toBe(6000);
    // 6000 + loose Shrimp (400) + Tuna Roll (300) + Salmon Roll (300)
    expect(calculateScore(hand)).toBe(7000);
  });

  it("counts two non-overlapping sets", () => {
    const hand = [
      card(Sushi.FATTY_TUNA),
      card(Sushi.CONGER_EEL),
      card(Sushi.CRAB),
      card(Sushi.TUNA),
      card(Sushi.SALMON),
      card(Sushi.SALMON_ROE),
      card(Sushi.OMELETTE),
      card(Sushi.TOFU),
      card(Sushi.CUCUMBER_ROLL),
      card(Sushi.KARAAGE),
    ];
    expect(calculateScore(hand)).toBe(8000);
  });

  it("detects completed sets", () => {
    expect(hasValidSet([card(Sushi.OMELETTE), card(Sushi.TOFU), card(Sushi.CUCUMBER_ROLL), card(Sushi.KARAAGE)])).toBe(true);
    expect(hasValidSet([card(Sushi.OMELETTE), card(Sushi.TOFU), card(Sushi.CUCUMBER_ROLL)])).toBe(false);
  });

  it("produces a breakdown with set and shoyu lines", () => {
    const hand = [
      card(Sushi.FATTY_TUNA),
      card(Sushi.CONGER_EEL),
      card(Sushi.CRAB),
      card(Sushi.TUNA),
      card(Sushi.SALMON_ROE),
      card(Sushi.SALMON),
      card(Sushi.KARAAGE),
      card("shoyu"),
    ];
    const lines = scoreBreakdown(hand);
    const labels = lines.map((l) => l.label);
    expect(labels).toContain("Omakase Set");
    expect(sum(lines.map((l) => l.points))).toBe(7000);
  });
});

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
