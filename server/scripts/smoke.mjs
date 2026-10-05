// Two-socket end-to-end smoke test for the LAN server.
// Usage: PORT=4010 npm run smoke   (server must already be running)
import { io } from "socket.io-client";

const URL = process.env.URL ?? `http://localhost:${process.env.PORT ?? 4010}`;
const sockets = [io(URL), io(URL)];
const views = [null, null];
const lastRev = [-1, -1];
let gameOver = null;
let plays = 0;

sockets.forEach((s) => {
  s.on("state", (v) => {
    views[v.you] = v;
    if (++plays > 8000) {
      console.error("smoke: too many steps — possible loop");
      process.exit(1);
    }
    // Only the seat whose turn it is acts, at most once per server revision.
    if (v.you === v.currentPlayer && v.rev > lastRev[v.you]) {
      lastRev[v.you] = v.rev;
      // Action 0 is always a safe "skip/continue/end" choice.
      s.emit("game:step", { action: 0 });
    }
  });
  s.on("gameOver", (p) => {
    gameOver = p;
    finish();
  });
  s.on("error", (e) => console.error("server error:", e));
});

function finish() {
  const v0 = views[0];
  const v1 = views[1];
  const leaked = v0?.players[1]?.hand !== undefined || v1?.players[0]?.hand !== undefined;
  const legalLeak =
    (v0 && v0.currentPlayer !== 0 && v0.legalActions.length > 0) ||
    (v1 && v1.currentPlayer !== 1 && v1.legalActions.length > 0);

  console.log("smoke: game over", JSON.stringify(gameOver));
  console.log("smoke: opponent hands hidden:", !leaked);
  console.log("smoke: legal actions only for current player:", !legalLeak);

  if (leaked || legalLeak) process.exit(1);
  console.log("smoke: PASS");
  process.exit(0);
}

setTimeout(() => {
  console.error("smoke: timeout waiting for game over");
  process.exit(1);
}, 30000);
