import { useGame } from "./useGame";
import { Table } from "./components/Table";
import { GameOver } from "./components/GameOver";

function Waiting({ seat }: { seat: number }) {
  const url = window.location.href;
  return (
    <div className="center">
      <h1>Omakase</h1>
      <p>
        You are <strong>Player {seat + 1}</strong>. Waiting for a second player.
      </p>
      <p className="muted">Open this address on the other device on your network:</p>
      <code className="share-url">{url}</code>
    </div>
  );
}

export default function App() {
  const g = useGame();

  if (!g.connected) {
    return (
      <div className="center">
        <h1>Omakase</h1>
        <p>Connecting to the server…</p>
      </div>
    );
  }

  if (g.seat == null) {
    return (
      <div className="center">
        <h1>Room full</h1>
        <p>Two players are already in this game.</p>
      </div>
    );
  }

  if (g.gameOver) {
    return (
      <GameOver
        payload={g.gameOver}
        seat={g.seat}
        opponentConnected={g.opponentConnected}
        onRestart={g.restart}
      />
    );
  }

  if (g.waiting || !g.view) {
    return <Waiting seat={g.seat} />;
  }

  return (
    <>
      <Table
        view={g.view}
        connected={g.connected}
        opponentConnected={g.opponentConnected}
        onStep={g.step}
      />
      {g.error ? <div className="toast">{g.error}</div> : null}
    </>
  );
}
