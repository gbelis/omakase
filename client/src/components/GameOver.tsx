import { useEffect } from "react";
import type { GameOverPayload } from "@omakase/shared";
import { sfx } from "../sound";

interface GameOverProps {
  payload: GameOverPayload;
  seat: number;
  opponentConnected: boolean;
  onRestart: () => void;
}

export function GameOver({ payload, seat, opponentConnected, onRestart }: GameOverProps) {
  const opp = 1 - seat;
  const verdict =
    payload.winner === "tie" ? "Tie game" : payload.winner === seat ? "You win!" : "Opponent wins";

  useEffect(() => {
    if (payload.winner === seat) sfx.win();
    else if (payload.winner !== "tie") sfx.lose();
  }, [payload.winner, seat]);

  return (
    <div className="gameover">
      <h1 className="gameover__verdict">{verdict}</h1>
      <div className="gameover__scores">
        {[seat, opp].map((s) => (
          <div key={s} className="scorecard">
            <div className="scorecard__who">{s === seat ? "You" : "Opponent"}</div>
            <div className="scorecard__pts">¥{(payload.results[s] ?? 0).toLocaleString()}</div>
            <ul className="scorecard__lines">
              {(payload.breakdown[s] ?? []).map((line, i) => (
                <li key={i}>
                  <span>{line.label}</span>
                  <span>+{line.points.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn--salmon btn--lg"
        disabled={!opponentConnected}
        onClick={() => {
          sfx.click();
          onRestart();
        }}
      >
        Rematch
      </button>
      {!opponentConnected && <p className="muted">Waiting for your opponent to reconnect…</p>}
    </div>
  );
}
