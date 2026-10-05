import type { Card as GameCard } from "@omakase/shared";
import { cardImage } from "../assets";

interface CardProps {
  card?: GameCard | null;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  disabled?: boolean;
  highlight?: boolean;
  onClick?: () => void;
  title?: string;
  count?: number;
}

function nameOf(card: GameCard): string {
  return card.isSushi ? card.sushiCard : card.actionCard;
}

export function CardView({
  card,
  faceDown,
  size = "md",
  selected,
  disabled,
  highlight,
  onClick,
  title,
  count,
}: CardProps) {
  const label = card ? nameOf(card).replace(/_/g, " ") : "card";
  const cls = [
    "card",
    "card--enter",
    `card--${size}`,
    selected ? "card--selected" : "",
    disabled ? "card--disabled" : "",
    highlight ? "card--highlight" : "",
    onClick && !disabled ? "card--clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cls}
      onClick={disabled ? undefined : onClick}
      title={title ?? label}
      aria-label={title ?? label}
      disabled={!onClick}
    >
      <img className="card__img" src={cardImage(card && !faceDown ? nameOf(card) : "cards_back")} alt={label} draggable={false} />
      {count != null && count > 1 ? <span className="card__count">×{count}</span> : null}
    </button>
  );
}
