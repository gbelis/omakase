# Omakase — 2 Player

A LAN-hosted, two-player version of the [Omakase](https://omakasegame.com) sushi
card game. The host's laptop runs a small authoritative server; the second
player opens the host's address in a browser.

- Full ruleset: draw → action → swap → action → shift belt → discard, plus all
  nine action cards, Wasabi skipping, check protection, and set scoring.
- Server-authoritative: hands and deck order are never sent to the other client.
- One game engine (`shared/`) used by the server, the tests, and (for legality
  hints) the client.

## Requirements

- Node.js 18+ (this repo was developed on Node 24).
- Both players need internet access on first load, because card artwork is
  hot-linked from `omakasegame.com`.

## Install

```bash
npm install
```

## Play on your local network (recommended)

Two terminals, or just use the combined dev script:

```bash
npm run dev
```

This starts:

- the game server on `http://localhost:3000`
- the Vite dev client on `http://localhost:5173` (socket.io is proxied to the server)

Then:

1. On the host laptop, open `http://localhost:5173`.
2. Find your LAN IP:

   ```bash
   ipconfig getifaddr en0      # Wi-Fi
   ipconfig getifaddr en1      # Ethernet (if different)
   ```

3. On the second device (same Wi-Fi), open `http://<LAN-IP>:5173`.
4. The first browser is Player 1; the second is Player 2. The game starts
   automatically once both are connected.

## Production (single port)

```bash
npm run build     # builds the client into client/dist
npm start         # serves the client + game on http://<LAN-IP>:3000
```

Open `http://<LAN-IP>:3000` on both devices.

## Play with someone not on your network

Expose the port with a tunnel, then share the tunnel URL:

```bash
# Option A — cloudflared
cloudflared tunnel --url http://localhost:3000

# Option B — ngrok
ngrok http 3000

# Option C — Tailscale (private, both install Tailscale)
#   then share your tailnet IP: http://<tailscale-ip>:3000
```

Use the production build (`npm run build`) when tunneling so a single port
serves everything.

## Controls

- **Step 1 / 3** — click an action card in your hand to play it, or **Skip Action**.
- **Step 2** — click a hand card, then a highlighted belt card to swap. You
  cannot swap two identical cards, and Ginger cannot be swapped.
- **Step 4** — **End Turn**, or **Call Check** when you have a complete menu.
- After a check, every other player gets one final turn.
- The game ends when the deck is empty (or after the final turns following a check).

## Project layout

```
shared/   pure TypeScript rules engine, card data, scoring, redaction, protocol
server/   Node http + Socket.IO server, rooms, static file serving
client/   React + Vite table UI
```

## Testing

```bash
npm test           # 30 engine/scoring tests
npm run typecheck  # all workspaces
npm run build      # client production build
# with a server running on :4010
PORT=4010 npm run start --workspace server
PORT=4010 npm run smoke --workspace server
```

## Notes

- Card images are loaded from `https://omakasegame.com/cards/`. If you want the
  game to work fully offline, download those PNGs and change `BASE` in
  `client/src/assets.ts`.
- Omakase is a commercial game by Jean Kesselring. This implementation is for
  private/local play; do not distribute it publicly without permission.
