// Card type constants. String values match the PNG filename stems used by the
// original game so that any asset pipeline can key off them directly.

export const Sushi = {
  ASSORTED_SASHIMI: "assorted_sashimi",
  PREMIUM_EEL: "premium_eel",
  OCTOPUS: "octopus",
  FATTY_TUNA: "fatty_tuna",
  CONGER_EEL: "conger_eel",
  CRAB: "crab",
  KARAAGE: "karaage",
  SALMON_ROE: "salmon_roe",
  TUNA: "tuna",
  SALMON: "salmon",
  SHRIMP: "shrimp",
  CUCUMBER_ROLL: "cucumber_roll",
  SALMON_ROLL: "salmon_roll",
  TUNA_ROLL: "tuna_roll",
  OMELETTE: "omelette",
  TOFU: "tofu",
} as const;

export type SushiName = (typeof Sushi)[keyof typeof Sushi];

export const Action = {
  CHOPSTICKS: "chopsticks",
  SAKE: "sake",
  UMESHU: "umeshu",
  CHEFS_CHOICE: "chefs_choice",
  WASABI: "wasabi",
  MATCHA: "matcha",
  SHOYU: "shoyu",
  FORK: "fork",
  GINGER: "ginger",
} as const;

export type ActionName = (typeof Action)[keyof typeof Action];

/** Cards that are never actively "played"; they take effect on draw or scoring. */
export const PASSIVE_ACTION_CARDS: ReadonlySet<ActionName> = new Set([
  Action.WASABI,
  Action.SHOYU,
  Action.GINGER,
]);

export const CARD_VALUES: Record<SushiName, number> = {
  [Sushi.ASSORTED_SASHIMI]: 1500,
  [Sushi.PREMIUM_EEL]: 1200,
  [Sushi.OCTOPUS]: 1100,
  [Sushi.FATTY_TUNA]: 1000,
  [Sushi.CONGER_EEL]: 700,
  [Sushi.CRAB]: 600,
  [Sushi.KARAAGE]: 500,
  [Sushi.SALMON_ROE]: 500,
  [Sushi.TUNA]: 400,
  [Sushi.SALMON]: 400,
  [Sushi.SHRIMP]: 400,
  [Sushi.CUCUMBER_ROLL]: 300,
  [Sushi.SALMON_ROLL]: 300,
  [Sushi.TUNA_ROLL]: 300,
  [Sushi.OMELETTE]: 200,
  [Sushi.TOFU]: 200,
};

export const CARD_DISPLAY_NAMES: Record<SushiName | ActionName, string> = {
  [Sushi.ASSORTED_SASHIMI]: "Assorted Sashimi",
  [Sushi.PREMIUM_EEL]: "Premium Eel",
  [Sushi.OCTOPUS]: "Octopus",
  [Sushi.FATTY_TUNA]: "Fatty Tuna",
  [Sushi.CONGER_EEL]: "Conger Eel",
  [Sushi.CRAB]: "Crab",
  [Sushi.KARAAGE]: "Karaage",
  [Sushi.SALMON_ROE]: "Salmon Roe",
  [Sushi.TUNA]: "Tuna",
  [Sushi.SALMON]: "Salmon",
  [Sushi.SHRIMP]: "Shrimp",
  [Sushi.CUCUMBER_ROLL]: "Cucumber Roll",
  [Sushi.SALMON_ROLL]: "Salmon Roll",
  [Sushi.TUNA_ROLL]: "Tuna Roll",
  [Sushi.OMELETTE]: "Omelette",
  [Sushi.TOFU]: "Tofu",
  [Action.CHOPSTICKS]: "Chopsticks",
  [Action.SAKE]: "Sake",
  [Action.UMESHU]: "Umeshu",
  [Action.CHEFS_CHOICE]: "Chef's Choice",
  [Action.WASABI]: "Wasabi",
  [Action.MATCHA]: "Matcha",
  [Action.SHOYU]: "Shoyu",
  [Action.FORK]: "Fork",
  [Action.GINGER]: "Ginger",
};

export interface SushiCardInstance {
  cardId: number;
  isSushi: true;
  sushiCard: SushiName;
  actionCard: null;
}

export interface ActionCardInstance {
  cardId: number;
  isSushi: false;
  sushiCard: null;
  actionCard: ActionName;
}

export type Card = SushiCardInstance | ActionCardInstance;

/** Deck composition (mirrors the physical game: 45 sushi + 17 action = 62 cards). */
export const SUSHI_COUNTS: ReadonlyArray<readonly [SushiName, number]> = [
  [Sushi.ASSORTED_SASHIMI, 1],
  [Sushi.PREMIUM_EEL, 1],
  [Sushi.OCTOPUS, 1],
  [Sushi.FATTY_TUNA, 1],
  [Sushi.CONGER_EEL, 2],
  [Sushi.CRAB, 2],
  [Sushi.KARAAGE, 3],
  [Sushi.SALMON_ROE, 3],
  [Sushi.TUNA, 3],
  [Sushi.SALMON, 3],
  [Sushi.SHRIMP, 3],
  [Sushi.CUCUMBER_ROLL, 4],
  [Sushi.SALMON_ROLL, 4],
  [Sushi.TUNA_ROLL, 4],
  [Sushi.OMELETTE, 5],
  [Sushi.TOFU, 5],
];

export const ACTION_COUNTS: ReadonlyArray<readonly [ActionName, number]> = [
  [Action.CHOPSTICKS, 3],
  [Action.SAKE, 2],
  [Action.UMESHU, 2],
  [Action.CHEFS_CHOICE, 2],
  [Action.WASABI, 2],
  [Action.MATCHA, 2],
  [Action.SHOYU, 2],
  [Action.FORK, 1],
  [Action.GINGER, 1],
];

export const TOTAL_DECK_SIZE = 62;

export function createDeck(): Card[] {
  const cards: Card[] = [];
  let cardId = 0;
  for (const [name, count] of SUSHI_COUNTS) {
    for (let i = 0; i < count; i++) {
      cards.push({ cardId, isSushi: true, sushiCard: name, actionCard: null });
      cardId++;
    }
  }
  for (const [name, count] of ACTION_COUNTS) {
    for (let i = 0; i < count; i++) {
      cards.push({ cardId, isSushi: false, sushiCard: null, actionCard: name });
      cardId++;
    }
  }
  return cards;
}

export function cardName(card: Card): SushiName | ActionName {
  return card.isSushi ? card.sushiCard : card.actionCard;
}

export function cardValue(card: Card): number {
  return card.isSushi ? CARD_VALUES[card.sushiCard] : 0;
}
