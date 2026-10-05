import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  ActionChoices,
  ClientToServerEvents,
  GameOverPayload,
  PlayerView,
  ServerToClientEvents,
} from "@omakase/shared";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface GameClient {
  connected: boolean;
  seat: number | null;
  view: PlayerView | null;
  gameOver: GameOverPayload | null;
  opponentConnected: boolean;
  waiting: boolean;
  error: string | null;
  step: (action: number, choices?: ActionChoices) => void;
  restart: () => void;
}

export function useGame(): GameClient {
  const socketRef = useRef<GameSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [seat, setSeat] = useState<number | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket: GameSocket = io();
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("seated", ({ seat: s }) => setSeat(s));
    socket.on("state", (v) => {
      setView(v);
      setWaiting(false);
      setGameOver(null);
    });
    socket.on("gameOver", (payload) => setGameOver(payload));
    socket.on("opponent", ({ connected: c }) => setOpponentConnected(c));
    socket.on("room:waiting", () => setWaiting(true));
    socket.on("error", ({ message }) => {
      setError(message);
      window.setTimeout(() => setError(null), 4000);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const step = (action: number, choices?: ActionChoices) => {
    socketRef.current?.emit("game:step", choices ? { action, choices } : { action });
  };
  const restart = () => socketRef.current?.emit("game:restart");

  return {
    connected,
    seat,
    view,
    gameOver,
    opponentConnected,
    waiting,
    error,
    step,
    restart,
  };
}
