import { useEffect, useRef, useState } from "react";
import {
  Action,
  CARD_DISPLAY_NAMES,
  MENU_SETS,
  PASSIVE_ACTION_CARDS,
  Phase,
  cardName,
  type ActionChoices,
  type Card,
  type PlayerView,
} from "@omakase/shared";
import { CardView } from "./Card";
import { isMuted, setMuted, sfx } from "../sound";

const MAX_BELT_SIZE = 6;

interface TableProps {
  view: PlayerView;
  connected: boolean;
  opponentConnected: boolean;
  onStep: (action: number, choices?: ActionChoices) => void;
}

interface PickerState {
  kind: "chopsticks" | "sake";
  action: number;
  stage: "victim" | "return";
  victimIdx?: number;
  sakeCardId: number;
}

function canExchange(hand: Card, belt: Card): boolean {
  if (!hand.isSushi && hand.actionCard === Action.GINGER) return false;
  if (hand.cardId === belt.cardId) return false;
  if (hand.isSushi && belt.isSushi && hand.sushiCard === belt.sushiCard) return false;
  if (!hand.isSushi && !belt.isSushi && hand.actionCard === belt.actionCard) return false;
  return true;
}

export function Table({ view, connected, opponentConnected, onStep }: TableProps) {
  const you = view.you;
  const oppIdx = 1 - you;
  const me = view.players[you]!;
  const opp = view.players[oppIdx]!;
  const myHand = me.hand ?? [];
  const isTurn = view.currentPlayer === you;
  const phase = view.phase;
  const oppHasCards = !opp.checkProtected && opp.handCount > 0;

  const [selectedHandId, setSelectedHandId] = useState<number | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [mutedUi, setMutedUi] = useState(isMuted());
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);

  const toastId = useRef(0);
  const prevBeltTop = useRef<number | null>(null);
  const prevWasabiLen = useRef(view.wasabiEvents.length);
  const prevHandIds = useRef<Set<number>>(new Set(myHand.map((c) => c.cardId)));
  const pendingGain = useRef(false);

  function pushToast(text: string) {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }

  useEffect(() => {
    setSelectedHandId(null);
  }, [view]);

  // Belt deal sound.
  useEffect(() => {
    const top = view.conveyorBelt[0]?.cardId ?? null;
    if (prevBeltTop.current !== null && top !== null && top !== prevBeltTop.current) sfx.belt();
    prevBeltTop.current = top;
  }, [view.conveyorBelt]);

  // Wasabi notifications.
  useEffect(() => {
    const events = view.wasabiEvents;
    if (events.length > prevWasabiLen.current) {
      for (const ev of events.slice(prevWasabiLen.current)) {
        if (ev.type === "draw") {
          pushToast(ev.playerIdx === you ? "You drew Wasabi — you skip next turn" : "Opponent drew Wasabi");
        } else {
          pushToast(ev.playerIdx === you ? "Your turn was skipped" : "Opponent's turn was skipped");
        }
      }
      sfx.action();
    }
    prevWasabiLen.current = events.length;
  }, [view.wasabiEvents, you]);

  // Reveal a card gained via Chopsticks / Sake.
  useEffect(() => {
    const ids = new Set(myHand.map((c) => c.cardId));
    if (pendingGain.current) {
      const gained = myHand.find((c) => !prevHandIds.current.has(c.cardId));
      if (gained) pushToast(`You received ${CARD_DISPLAY_NAMES[cardName(gained)]}`);
      pendingGain.current = false;
    }
    prevHandIds.current = ids;
  }, [view]);

  const selectedHand = myHand.find((c) => c.cardId === selectedHandId) ?? null;
  const playableActions = myHand.filter(
    (c) => !c.isSushi && !PASSIVE_ACTION_CARDS.has(c.actionCard),
  );

  function doStep(action: number, choices?: ActionChoices) {
    setSelectedHandId(null);
    setPicker(null);
    onStep(action, choices);
  }

  function beginAction(card: Card) {
    if (card.isSushi) return;
    sfx.action();
    const idx = playableActions.indexOf(card) + 1;
    const name = card.actionCard;
    if (name === Action.CHOPSTICKS && oppHasCards) {
      pendingGain.current = true;
      setPicker({ kind: "chopsticks", action: idx, stage: "victim", sakeCardId: card.cardId });
      return;
    }
    if (name === Action.SAKE && oppHasCards) {
      pendingGain.current = true;
      setPicker({ kind: "sake", action: idx, stage: "victim", sakeCardId: card.cardId });
      return;
    }
    doStep(idx);
  }

  function onHandClick(card: Card) {
    if (!isTurn) return;
    if (phase === Phase.PHASE_1 || phase === Phase.PHASE_3) {
      if (!card.isSushi && !PASSIVE_ACTION_CARDS.has(card.actionCard)) beginAction(card);
      return;
    }
    if (phase === Phase.PHASE_2) {
      if (!card.isSushi && card.actionCard === Action.GINGER) return;
      sfx.select();
      setSelectedHandId(card.cardId);
      return;
    }
    if (phase === Phase.CHEFS_CHOICE_SELECT_CARDS || phase === Phase.PHASE_DISCARD) {
      sfx.select();
      doStep(myHand.indexOf(card));
    }
  }

  function onBeltClick(bIdx: number, beltCard: Card) {
    if (!isTurn || phase !== Phase.PHASE_2 || !selectedHand) return;
    if (!canExchange(selectedHand, beltCard)) return;
    sfx.swap();
    const hIdx = myHand.indexOf(selectedHand);
    doStep(hIdx * MAX_BELT_SIZE + bIdx);
  }

  function handState(card: Card): { clickable: boolean; highlight: boolean } {
    if (!isTurn) return { clickable: false, highlight: false };
    if (phase === Phase.PHASE_1 || phase === Phase.PHASE_3) {
      const ok = !card.isSushi && !PASSIVE_ACTION_CARDS.has(card.actionCard);
      return { clickable: ok, highlight: false };
    }
    if (phase === Phase.PHASE_2) {
      const ginger = !card.isSushi && card.actionCard === Action.GINGER;
      const anyLegal = view.conveyorBelt.some((b) => canExchange(card, b));
      return { clickable: !ginger && anyLegal, highlight: false };
    }
    if (phase === Phase.CHEFS_CHOICE_SELECT_CARDS) return { clickable: true, highlight: false };
    if (phase === Phase.PHASE_DISCARD) return { clickable: true, highlight: false };
    return { clickable: false, highlight: false };
  }

  function instruction(): string {
    if (!isTurn) return "Opponent's turn…";
    switch (phase) {
      case Phase.PHASE_1:
        return "Step 1 — Play an action card, or skip.";
      case Phase.PHASE_2:
        return selectedHand
          ? "Step 2 — Choose a card on the conveyor belt to swap with."
          : "Step 2 — Select a card from your hand to swap.";
      case Phase.PHASE_3:
        return view.actionPlayedThisTurn
          ? "Step 3 — No action left this turn."
          : "Step 3 — Play an action card, or continue.";
      case Phase.PHASE_4:
        return view.legalActions.includes(1)
          ? "Step 4 — Call check to end the game after final turns, or end turn."
          : "Step 4 — End your turn.";
      case Phase.CHEFS_CHOICE_SELECT_CARDS:
        return `Chef's Choice — select 2 cards to return (${view.chefsChoice?.selectedCount ?? 0}/2).`;
      case Phase.CHEFS_CHOICE_SELECT_POSITIONS:
        return `Chef's Choice — choose deck positions (${view.chefsChoice?.selectedPositions ?? 0}/2).`;
      case Phase.PHASE_DISCARD:
        return "Over the hand limit — discard a card.";
      default:
        return "";
    }
  }

  const handForReturn = picker
    ? myHand.filter((c) => c.cardId !== picker.sakeCardId)
    : [];

  return (
    <div className="table">
      <div className={`turn-banner ${isTurn ? "turn-banner--you" : ""}`}>
        <span>{isTurn ? "Your turn" : "Opponent's turn"}</span>
        <span className="turn-banner__right">
          <span className="turn-banner__conn">
            {connected ? (opponentConnected ? "2 players" : "waiting for opponent") : "disconnected"}
          </span>
          <button
            type="button"
            className="mute-btn"
            onClick={() => {
              const next = !mutedUi;
              setMuted(next);
              setMutedUi(next);
              if (!next) sfx.click();
            }}
            aria-label={mutedUi ? "Unmute sounds" : "Mute sounds"}
            title={mutedUi ? "Unmute sounds" : "Mute sounds"}
          >
            {mutedUi ? "🔇" : "🔊"}
          </button>
        </span>
      </div>

      <section className="zone zone--opp">
        <div className="zone__label">
          Opponent · {opp.handCount} card{opp.handCount === 1 ? "" : "s"}
          {opp.checkProtected ? " · protected" : ""}
        </div>
        <div className="row row--opp">
          {Array.from({ length: opp.handCount }).map((_, i) => (
            <CardView key={i} faceDown size="sm" />
          ))}
        </div>
      </section>

      <section className="belt">
        <div className="pile">
          <div className="pile__stack">
            <CardView faceDown size="md" />
          </div>
          <div className="pile__label">Deck · {view.deckCount}</div>
        </div>

        <div className="belt__track">
          {view.conveyorBelt.map((bCard, bIdx) => {
            const highlight =
              isTurn &&
              phase === Phase.PHASE_2 &&
              !!selectedHand &&
              canExchange(selectedHand, bCard);
            return (
              <CardView
                key={bCard.cardId}
                card={bCard}
                highlight={highlight}
                onClick={() => onBeltClick(bIdx, bCard)}
                title={CARD_DISPLAY_NAMES[cardName(bCard)]}
              />
            );
          })}
        </div>

        <div className="pile">
          <div className="pile__stack">
            <button type="button" className="trash-btn" onClick={() => setShowTrash(true)}>
              Discard
            </button>
          </div>
          <div className="pile__label">Trash · {view.trash.length}</div>
        </div>
      </section>

      <div className="phase-bar">
        <div className="phase-pips">
          {["Action", "Swap", "Action", "Check"].map((label, i) => (
            <span
              key={i}
              className={`phase-pip ${phase === i || (i === 3 && phase === Phase.PHASE_4) ? "phase-pip--active" : ""}`}
            >
              {label}
            </span>
          ))}
        </div>
        <p className="phase-msg">{instruction()}</p>
      </div>

      <section className="zone zone--me">
        <div className="zone__label">
          You · {myHand.length}/{me.maxHandSize} cards
          {me.matchaCount > 0 ? ` · ${me.matchaCount} matcha` : ""}
          {me.wasabiSkipFlag > 0 ? ` · wasabi skip ×${me.wasabiSkipFlag}` : ""}
        </div>
        <div className="row row--hand">
          {myHand.map((card) => {
            const st = handState(card);
            return (
              <CardView
                key={card.cardId}
                card={card}
                selected={selectedHandId === card.cardId}
                highlight={st.highlight}
                disabled={!st.clickable}
                onClick={() => onHandClick(card)}
                title={CARD_DISPLAY_NAMES[cardName(card)]}
              />
            );
          })}
        </div>
      </section>

      <div className="controls">
        {(phase === Phase.PHASE_1 || phase === Phase.PHASE_3) && (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!isTurn}
            onClick={() => {
              sfx.click();
              doStep(0);
            }}
          >
            Skip Action
          </button>
        )}
        {phase === Phase.PHASE_4 && (
          <>
            <button
              type="button"
              className="btn"
              disabled={!isTurn}
              onClick={() => {
                sfx.click();
                doStep(0);
              }}
            >
              End Turn
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={!isTurn || !view.legalActions.includes(1)}
              onClick={() => {
                sfx.check();
                doStep(1);
              }}
            >
              Call Check
            </button>
          </>
        )}
        {(phase === Phase.CHEFS_CHOICE_SELECT_POSITIONS) && (
          <div className="positions">
            {Array.from({ length: view.chefsChoice?.deckPositions ?? 0 }).map((_, i) => (
              <button
                key={i}
                type="button"
                className="btn btn--pos"
                disabled={!isTurn}
                onClick={() => doStep(i)}
              >
                {i === 0 ? "Top" : i === (view.chefsChoice?.deckPositions ?? 1) - 1 ? "Bottom" : i}
              </button>
            ))}
          </div>
        )}
      </div>

      {picker?.stage === "victim" && (
        <div className="modal-bg" role="dialog" aria-modal="true">
          <div className="modal">
            <h2 className="modal__title">
              {picker.kind === "sake" ? "Sake — pick a face-down card" : "Chopsticks — steal a card"}
            </h2>
            <div className="row row--pick">
              {Array.from({ length: opp.handCount }).map((_, i) => (
                <CardView
                  key={i}
                  faceDown
                  onClick={() =>
                    picker.kind === "chopsticks"
                      ? doStep(picker.action, { victimCardIdx: i })
                      : setPicker({ ...picker, stage: "return", victimIdx: i })
                  }
                />
              ))}
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={() => setPicker(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {picker?.stage === "return" && (
        <div className="modal-bg" role="dialog" aria-modal="true">
          <div className="modal">
            <h2 className="modal__title">Sake — give a card back</h2>
            <div className="row row--pick">
              {handForReturn.map((c, i) => (
                <CardView
                  key={c.cardId}
                  card={c}
                  onClick={() =>
                    doStep(picker.action, {
                      victimCardIdx: picker.victimIdx ?? 0,
                      returnCardIdx: i,
                    })
                  }
                  title={CARD_DISPLAY_NAMES[cardName(c)]}
                />
              ))}
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={() => setPicker(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showTrash && (
        <div className="modal-bg" role="dialog" aria-modal="true" onClick={() => setShowTrash(false)}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal__title">Discard pile · {view.trash.length}</h2>
            <div className="row row--pick row--scroll">
              {view.trash.map((c) => (
                <CardView key={c.cardId} card={c} size="sm" title={CARD_DISPLAY_NAMES[cardName(c)]} />
              ))}
            </div>
            <div className="modal__footer">
              <button type="button" className="btn" onClick={() => setShowTrash(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <details className="sets">
        <summary>Menu sets</summary>
        <ul>
          {MENU_SETS.map((set) => {
            const owned = myHand.filter(
              (c) => c.isSushi && set.cards.has(c.sushiCard),
            ).length;
            return (
              <li key={set.name}>
                <strong>{set.name}</strong> · {set.value.toLocaleString()}¥ · {owned}/
                {set.cards.size}
              </li>
            );
          })}
        </ul>
      </details>

      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
