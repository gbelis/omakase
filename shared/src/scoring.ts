import { Action, CARD_VALUES, CARD_DISPLAY_NAMES, type Card, type SushiName } from "./data/cards";
import {
  ALL_SETS,
  KIDS_SET,
  OMAKASE_SET,
  SAKURA_SET,
  UME_SET,
  type MenuSet,
} from "./data/sets";

export interface SetResult {
  usedCounter: Partial<Record<SushiName, number>>;
  setsScore: number;
}

export interface ScoreLine {
  label: string;
  points: number;
}

/** Optimally allocate duplicate/overlapping sushi across sets via backtracking. */
export function findOptimalSets(counts: Partial<Record<SushiName, number>>): SetResult {
  let bestScore = 0;
  let bestUsed: Partial<Record<SushiName, number>> = {};

  function tryRecursive(
    remaining: Partial<Record<SushiName, number>>,
    used: Partial<Record<SushiName, number>>,
    score: number,
  ): void {
    if (score > bestScore) {
      bestScore = score;
      bestUsed = { ...used };
    }
    for (const [setCards, setValue] of ALL_SETS) {
      let canForm = true;
      for (const t of setCards) {
        if ((remaining[t] ?? 0) <= 0) {
          canForm = false;
          break;
        }
      }
      if (!canForm) continue;

      const newRemaining: Partial<Record<SushiName, number>> = { ...remaining };
      const newUsed: Partial<Record<SushiName, number>> = { ...used };
      for (const t of setCards) {
        newRemaining[t] = (newRemaining[t] ?? 0) - 1;
        newUsed[t] = (newUsed[t] ?? 0) + 1;
      }
      tryRecursive(newRemaining, newUsed, score + setValue);
    }
  }

  tryRecursive({ ...counts }, {}, 0);
  return { usedCounter: bestUsed, setsScore: bestScore };
}

function calculateStandaloneScore(sushiCards: Card[], shoyuCount: number): number {
  if (sushiCards.length === 0) return 0;
  const baseValues = sushiCards.map((c) => (c.isSushi ? CARD_VALUES[c.sushiCard] : 0));
  let total = baseValues.reduce((a, b) => a + b, 0);
  if (shoyuCount > 0) {
    const applications = Math.min(shoyuCount, sushiCards.length);
    for (let i = 0; i < applications; i++) total += baseValues[i];
  }
  return total;
}

export function calculateScore(hand: readonly Card[]): number {
  const sushiCards = hand.filter((c) => c.isSushi);
  const actionCards = hand.filter((c) => !c.isSushi);
  const shoyuCount = actionCards.filter((c) => c.actionCard === Action.SHOYU).length;

  const typeCounts: Partial<Record<SushiName, number>> = {};
  for (const c of sushiCards) {
    if (!c.isSushi) continue;
    typeCounts[c.sushiCard] = (typeCounts[c.sushiCard] ?? 0) + 1;
  }

  const { usedCounter, setsScore } = findOptimalSets(typeCounts);

  const remaining: Partial<Record<SushiName, number>> = { ...typeCounts };
  for (const [t, used] of Object.entries(usedCounter) as [SushiName, number][]) {
    remaining[t] = (remaining[t] ?? 0) - used;
  }

  const unusedSushi: Card[] = [];
  const rem2: Partial<Record<SushiName, number>> = { ...remaining };
  for (const c of sushiCards) {
    if (!c.isSushi) continue;
    if ((rem2[c.sushiCard] ?? 0) > 0) {
      unusedSushi.push(c);
      rem2[c.sushiCard] = (rem2[c.sushiCard] ?? 0) - 1;
    }
  }

  unusedSushi.sort((a, b) => {
    const av = a.isSushi ? CARD_VALUES[a.sushiCard] : 0;
    const bv = b.isSushi ? CARD_VALUES[b.sushiCard] : 0;
    return bv - av;
  });

  return setsScore + calculateStandaloneScore(unusedSushi, shoyuCount);
}

function isSuperset(set: ReadonlySet<SushiName>, subset: ReadonlySet<SushiName>): boolean {
  for (const item of subset) if (!set.has(item)) return false;
  return true;
}

export function hasValidSet(hand: readonly Card[]): boolean {
  const sushiTypes = new Set<SushiName>();
  for (const c of hand) if (c.isSushi) sushiTypes.add(c.sushiCard);
  return (
    isSuperset(sushiTypes, OMAKASE_SET) ||
    isSuperset(sushiTypes, SAKURA_SET) ||
    isSuperset(sushiTypes, UME_SET) ||
    isSuperset(sushiTypes, KIDS_SET)
  );
}

export function completedSets(hand: readonly Card[]): MenuSet[] {
  const sushiTypes = new Set<SushiName>();
  for (const c of hand) if (c.isSushi) sushiTypes.add(c.sushiCard);
  return ALL_SETS.filter(([cards]) => isSuperset(sushiTypes, cards)).map(
    ([cards, value]) => setMenu(cards, value),
  );
}

function setMenu(cards: ReadonlySet<SushiName>, value: number): MenuSet {
  if (isSuperset(cards, OMAKASE_SET) && value === 6000) return { name: "Omakase Set", value, cards };
  if (isSuperset(cards, SAKURA_SET) && value === 4500) return { name: "Sakura Set", value, cards };
  if (isSuperset(cards, UME_SET) && value === 3500) return { name: "Ume Set", value, cards };
  if (isSuperset(cards, KIDS_SET) && value === 2000) return { name: "Kids Set", value, cards };
  return { name: "Set", value, cards };
}

export function scoreBreakdown(hand: readonly Card[]): ScoreLine[] {
  const sushiCards = hand.filter((c) => c.isSushi);
  const actionCards = hand.filter((c) => !c.isSushi);
  const shoyuCount = actionCards.filter((c) => c.actionCard === Action.SHOYU).length;

  const typeCounts: Partial<Record<SushiName, number>> = {};
  for (const c of sushiCards) {
    if (!c.isSushi) continue;
    typeCounts[c.sushiCard] = (typeCounts[c.sushiCard] ?? 0) + 1;
  }

  const { usedCounter, setsScore } = findOptimalSets(typeCounts);

  const lines: ScoreLine[] = [];
  const remaining: Partial<Record<SushiName, number>> = { ...typeCounts };
  for (const [t, used] of Object.entries(usedCounter) as [SushiName, number][]) {
    remaining[t] = (remaining[t] ?? 0) - used;
  }

  for (const [setCards, setValue] of ALL_SETS) {
    let usedForThisSet = true;
    for (const t of setCards) {
      if ((usedCounter[t] ?? 0) <= 0) {
        usedForThisSet = false;
        break;
      }
    }
    if (usedForThisSet) lines.push({ label: setMenu(setCards, setValue).name, points: setValue });
  }
  if (setsScore === 0) lines.length = 0;

  const unusedSushi: Card[] = [];
  const rem2: Partial<Record<SushiName, number>> = { ...remaining };
  for (const c of sushiCards) {
    if (!c.isSushi) continue;
    if ((rem2[c.sushiCard] ?? 0) > 0) {
      unusedSushi.push(c);
      rem2[c.sushiCard] = (rem2[c.sushiCard] ?? 0) - 1;
    }
  }
  unusedSushi.sort((a, b) => {
    const av = a.isSushi ? CARD_VALUES[a.sushiCard] : 0;
    const bv = b.isSushi ? CARD_VALUES[b.sushiCard] : 0;
    return bv - av;
  });

  const applications = Math.min(shoyuCount, unusedSushi.length);
  for (let i = 0; i < unusedSushi.length; i++) {
    const card = unusedSushi[i];
    const name = card.isSushi ? CARD_DISPLAY_NAMES[card.sushiCard] : "?";
    const val = card.isSushi ? CARD_VALUES[card.sushiCard] : 0;
    const doubled = i < applications;
    lines.push({ label: name + (doubled ? " (Shoyu ×2)" : ""), points: doubled ? val * 2 : val });
  }

  return lines;
}
