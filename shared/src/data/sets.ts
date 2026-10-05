import { Sushi, type SushiName } from "./cards";

export interface MenuSet {
  name: string;
  value: number;
  cards: ReadonlySet<SushiName>;
}

export const OMAKASE_SET: ReadonlySet<SushiName> = new Set([
  Sushi.FATTY_TUNA,
  Sushi.CONGER_EEL,
  Sushi.CRAB,
  Sushi.TUNA,
  Sushi.SALMON,
  Sushi.SALMON_ROE,
]);

export const SAKURA_SET: ReadonlySet<SushiName> = new Set([
  Sushi.CONGER_EEL,
  Sushi.CRAB,
  Sushi.TUNA,
  Sushi.SHRIMP,
  Sushi.TUNA_ROLL,
  Sushi.SALMON_ROLL,
]);

export const UME_SET: ReadonlySet<SushiName> = new Set([
  Sushi.SALMON_ROE,
  Sushi.SALMON,
  Sushi.SHRIMP,
  Sushi.TUNA_ROLL,
  Sushi.SALMON_ROLL,
  Sushi.OMELETTE,
]);

export const KIDS_SET: ReadonlySet<SushiName> = new Set([
  Sushi.OMELETTE,
  Sushi.CUCUMBER_ROLL,
  Sushi.TOFU,
  Sushi.KARAAGE,
]);

export const ALL_SETS: ReadonlyArray<readonly [ReadonlySet<SushiName>, number]> = [
  [OMAKASE_SET, 6000],
  [SAKURA_SET, 4500],
  [UME_SET, 3500],
  [KIDS_SET, 2000],
];

export const MENU_SETS: ReadonlyArray<MenuSet> = [
  { name: "Omakase Set", value: 6000, cards: OMAKASE_SET },
  { name: "Sakura Set", value: 4500, cards: SAKURA_SET },
  { name: "Ume Set", value: 3500, cards: UME_SET },
  { name: "Kids Set", value: 2000, cards: KIDS_SET },
];
