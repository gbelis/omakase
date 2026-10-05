import { Sushi, type ActionName, type Card, type SushiName } from "./data/cards";

export function sushi(name: SushiName, cardId = 0): Card {
  return { cardId, isSushi: true, sushiCard: name, actionCard: null };
}

export function action(name: ActionName, cardId = 0): Card {
  return { cardId, isSushi: false, sushiCard: null, actionCard: name };
}

let nextId = 10_000;

/** Build a card from either a sushi or action name, with a unique id. */
export function card(name: SushiName | ActionName): Card {
  if ((Object.values(Sushi) as string[]).includes(name)) {
    return sushi(name as SushiName, nextId++);
  }
  return action(name as ActionName, nextId++);
}

export function cards(...names: (SushiName | ActionName)[]): Card[] {
  return names.map((n) => card(n));
}
