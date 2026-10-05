import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { redact, type ClientToServerEvents, type ServerToClientEvents } from "@omakase/shared";
import { Room } from "./room";

const PORT = Number(process.env.PORT ?? 3000);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLIENT_DIST = resolve(__dirname, "../../client/dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (req.url === "/api/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, game: "omakase", players: 2 }));
    return true;
  }

  const url = (req.url ?? "/").split("?")[0] ?? "/";
  let filePath = join(CLIENT_DIST, normalize(url));
  if (!filePath.startsWith(CLIENT_DIST)) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }

  try {
    const info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) filePath = join(filePath, "index.html");
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
    res.end(body);
    return true;
  } catch {
    // SPA fallback for client-side routes.
    try {
      const body = await readFile(join(CLIENT_DIST, "index.html"));
      res.writeHead(200, { "content-type": MIME[".html"]! });
      res.end(body);
      return true;
    } catch {
      return false;
    }
  }
}

const httpServer = createServer((req, res) => {
  void serveStatic(req, res).then((handled) => {
    if (!handled) {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(
        "Omakase server is running. Build the client (npm run build) to serve the table here.\n",
      );
    }
  });
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*" },
});

const room = new Room();
let revision = 0;

function sendStateTo(socketId: string | null): void {
  if (!socketId) return;
  const socket = io.sockets.sockets.get(socketId);
  if (!socket) return;
  const seat = room.seatOf(socketId);
  if (seat == null) return;
  const isCurrent = room.engine.state.currentPlayer === seat;
  const legalActions = isCurrent ? room.engine.getLegalActions() : [];
  socket.emit("state", redact(room.engine.state, seat, legalActions, revision));
}

function broadcastState(): void {
  revision++;
  for (let seat = 0; seat < room.numPlayers; seat++) {
    sendStateTo(room.socketIdAt(seat));
  }
}

function broadcastGameOver(): void {
  const payload = room.gameOverPayload();
  for (let seat = 0; seat < room.numPlayers; seat++) {
    const id = room.socketIdAt(seat);
    if (id) io.sockets.sockets.get(id)?.emit("gameOver", payload);
  }
}

io.on("connection", (socket) => {
  const seat = room.assign(socket.id);
  if (seat < 0) {
    socket.emit("error", { message: "Room is full — Omakase is a two-player game." });
    socket.disconnect(true);
    return;
  }

  socket.emit("server:hello", { ok: true });
  socket.emit("seated", { seat, numPlayers: room.numPlayers });

  const startedNow = room.startIfReady();
  io.emit("opponent", { connected: room.isFull() });
  if (!room.isFull()) socket.emit("room:waiting");

  if (startedNow || room.started) {
    broadcastState();
    if (room.engine.state.gameOver) broadcastGameOver();
  }

  socket.on("game:step", ({ action, choices }) => {
    if (room.seatOf(socket.id) !== room.engine.state.currentPlayer) {
      socket.emit("error", { message: "It is not your turn." });
      return;
    }
    if (room.engine.state.gameOver) return;
    room.engine.setActionChoices(choices ?? null);
    room.engine.step(action);
    room.engine.setActionChoices(null);
    broadcastState();
    if (room.engine.state.gameOver) broadcastGameOver();
  });

  socket.on("game:restart", () => {
    if (room.seatOf(socket.id) == null) return;
    if (!room.isFull()) {
      socket.emit("error", { message: "Waiting for a second player to start." });
      return;
    }
    room.start();
    broadcastState();
  });

  socket.on("game:requestState", () => {
    if (room.started) sendStateTo(socket.id);
  });

  socket.on("disconnect", () => {
    room.release(socket.id);
    io.emit("opponent", { connected: room.isFull() });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Omakase server listening on http://localhost:${PORT}`);
});
