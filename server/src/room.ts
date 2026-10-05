import {
  OmakaseEngine,
  scoreBreakdown,
  type GameOverPayload,
} from "@omakase/shared";

const NUM_PLAYERS = 2;

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * A single two-seat game room. Holds the authoritative engine and the mapping
 * from seat index to the currently connected socket id. State survives a
 * disconnect so a player can reconnect into their seat.
 */
export class Room {
  readonly numPlayers = NUM_PLAYERS;
  readonly engine = new OmakaseEngine(NUM_PLAYERS);
  readonly seats: (string | null)[] = Array.from({ length: NUM_PLAYERS }, () => null);
  started = false;

  seatOf(socketId: string): number | null {
    const idx = this.seats.indexOf(socketId);
    return idx === -1 ? null : idx;
  }

  /** Seat a socket, preferring its original seat if known, else first free. */
  assign(socketId: string, preferSeat?: number): number {
    if (preferSeat != null && this.seats[preferSeat] == null) {
      this.seats[preferSeat] = socketId;
      return preferSeat;
    }
    const free = this.seats.indexOf(null);
    if (free === -1) return -1;
    this.seats[free] = socketId;
    return free;
  }

  release(socketId: string): void {
    const idx = this.seats.indexOf(socketId);
    if (idx !== -1) this.seats[idx] = null;
  }

  isFull(): boolean {
    return this.seats.every((s) => s != null);
  }

  socketIdAt(seat: number): string | null {
    return this.seats[seat] ?? null;
  }

  start(seed: number = randomSeed()): void {
    this.engine.reset(seed);
    this.started = true;
  }

  /** Ensure a fair seed and a fresh game when both seats first fill. */
  startIfReady(): boolean {
    if (!this.started && this.isFull()) {
      this.start();
      return true;
    }
    return false;
  }

  gameOverPayload(): GameOverPayload {
    const results = this.engine.getGameResults();
    const breakdown: GameOverPayload["breakdown"] = {};
    for (let i = 0; i < this.numPlayers; i++) {
      breakdown[i] = scoreBreakdown(this.engine.state.players[i].hand);
    }
    const values = Object.values(results);
    const max = Math.max(...values);
    const winners = Object.entries(results)
      .filter(([, v]) => v === max)
      .map(([k]) => Number(k));
    return {
      results,
      winner: winners.length === 1 ? winners[0]! : "tie",
      breakdown,
    };
  }
}
