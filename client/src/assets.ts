const BASE = "https://omakasegame.com/cards";

// Two asset filename exceptions in the source game.
const OVERRIDES: Record<string, string> = {
  karaage: "Karaage",
  shoyu: "Shoyu",
};

export function cardImage(name: string): string {
  return `${BASE}/${OVERRIDES[name] ?? name}.png`;
}

export const CARD_BACK = `${BASE}/cards_back.png`;
