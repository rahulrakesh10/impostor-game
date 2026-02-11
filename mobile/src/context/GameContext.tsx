import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_URL } from '../config';
import type { GameState, Player } from '../types';

type GameContextValue = {
  gameState: GameState;
  socketConnected: boolean;
  error: string | null;
  countdown: number;
  selectedAnswer: string;
  setSelectedAnswer: (id: string) => void;
  answerSubmitted: boolean;
  voteSubmitted: boolean;
  joinRoom: (pin: string, displayName: string) => void;
  submitAnswer: () => void;
  submitVote: () => void;
  clearError: () => void;
};

const joinContextStorageKey = '@fakeout_join_context';

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [gameState, setGameState] = useState<GameState>({ state: 'landing' });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const joinContext = useRef<{ userId: string; displayName: string; pin: string } | null>(null);
  const reconnectionAttempted = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(joinContextStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as { userId: string; displayName: string; pin: string };
          joinContext.current = parsed;
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setSocketConnected(true);
      setError(null);
    });

    newSocket.on('connect_error', (err: Error) => {
      setSocketConnected(false);
      setError(`Connection failed: ${err.message}`);
    });

    newSocket.on('disconnect', (reason: string) => {
      setSocketConnected(false);
      if (reason === 'io server disconnect') setError('Connection lost. Please try again.');
    });

    newSocket.on('reconnect', () => {
      setSocketConnected(true);
      setError(null);
      if (joinContext.current && !reconnectionAttempted.current) {
        reconnectionAttempted.current = true;
        setTimeout(() => {
          if (joinContext.current) {
            newSocket.emit('room:rejoin', {
              pin: joinContext.current.pin,
              userId: joinContext.current.userId,
              displayName: joinContext.current.displayName,
            });
          }
        }, 1000);
      }
    });

    newSocket.on('room:joined', (data: { pin: string }) => {
      const ctx = joinContext.current;
      setError(null);
      setGameState((prev) => ({
        ...prev,
        state: 'lobby',
        user: ctx ? { id: ctx.userId, displayName: ctx.displayName, isHost: false } : prev.user,
        room: { pin: data.pin, players: [] },
      }));
    });

    newSocket.on('room:update', (data: { players: Player[] }) => {
      setGameState((prev) => {
        const pin = prev.room?.pin ?? joinContext.current?.pin ?? '';
        const merged = prev.room ? { ...prev.room, players: data.players } : { pin, players: data.players ?? [] };
        return { ...prev, room: merged };
      });
    });

    newSocket.on('round:start', (data: { timer: number }) => {
      setGameState((prev) => ({ ...prev, state: 'answering', timer: data.timer }));
      setSelectedAnswer('');
      setCountdown(data.timer);
      setAnswerSubmitted(false);
      setVoteSubmitted(false);
    });

    newSocket.on('prompt:group', (data: { text: string }) => {
      setGameState((prev) => ({ ...prev, currentQuestion: data.text, isFake: false }));
    });

    newSocket.on('prompt:fake', (data: { text: string }) => {
      setGameState((prev) => ({ ...prev, currentQuestion: data.text, isFake: true }));
    });

    newSocket.on('discussion:start', (data: { timer: number; question: string }) => {
      setGameState((prev) => ({
        ...prev,
        state: 'discussing',
        timer: data.timer,
        currentQuestion: data.question,
      }));
      setCountdown(data.timer);
    });

    newSocket.on('voting:start', (data: { timer: number }) => {
      setGameState((prev) => ({ ...prev, state: 'voting', timer: data.timer }));
      setSelectedAnswer('');
      setCountdown(data.timer);
      setVoteSubmitted(false);
    });

    newSocket.on('round:result', (data: { scores: GameState['scores']; fakeId: string; fakeCaught: boolean; fakeQuestion?: string }) => {
      setGameState((prev) => ({
        ...prev,
        state: 'results',
        scores: data.scores,
        lastResult: {
          fakeId: data.fakeId,
          fakeCaught: data.fakeCaught,
          fakeQuestion: data.fakeQuestion,
        },
      }));
      setCountdown(5);
    });

    newSocket.on('timer:update', (data: { timeLeft: number }) => setCountdown(data.timeLeft));

    newSocket.on('game:end', (data: { finalScores: GameState['scores'] }) => {
      setGameState((prev) => ({ ...prev, state: 'ended', scores: data.finalScores }));
    });

    newSocket.on('error', (data: { message: string }) => {
      setError(data.message);
      setGameState((prev) => ({ ...prev, state: 'landing' }));
    });

    newSocket.on('player:kicked', (data: { message?: string }) => {
      setError(data.message ?? 'You have been kicked from the game.');
      setTimeout(() => {
        setGameState({ state: 'landing', user: undefined, room: undefined });
        setError(null);
      }, 3000);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const joinRoom = useCallback(
    async (pin: string, displayName: string) => {
      const existing = joinContext.current;
      const stored = await AsyncStorage.getItem(joinContextStorageKey);
      let parsed: { userId: string; displayName: string; pin: string } | null = null;
      if (stored) try {
        parsed = JSON.parse(stored);
      } catch {}

      let userId: string;
      if (existing && parsed?.pin === pin && parsed?.displayName === displayName) {
        userId = existing.userId;
      } else {
        userId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${Math.random().toString(36).slice(2, 9)}`;
      }

      const ctx = { userId, displayName, pin };
      joinContext.current = ctx;
      await AsyncStorage.setItem(joinContextStorageKey, JSON.stringify(ctx));

      setError(null);
      reconnectionAttempted.current = false;

      if (!socket || !socketConnected) {
        setError('Not connected. Please wait...');
        return;
      }

      socket.emit('room:join', { pin, userId, displayName });
      socket.emit('user:identify', { userId, pin });
    },
    [socket, socketConnected]
  );

  const submitAnswer = useCallback(() => {
    if (!selectedAnswer || !gameState.room?.pin || !socket) return;
    socket.emit('answer:submit', { pin: gameState.room.pin, targetUserId: selectedAnswer });
    setAnswerSubmitted(true);
  }, [selectedAnswer, gameState.room?.pin, socket]);

  const submitVote = useCallback(() => {
    if (!selectedAnswer || !gameState.room?.pin || !socket) return;
    socket.emit('vote:submit', { pin: gameState.room.pin, targetUserId: selectedAnswer });
    setVoteSubmitted(true);
  }, [selectedAnswer, gameState.room?.pin, socket]);

  const clearError = useCallback(() => setError(null), []);

  const value: GameContextValue = {
    gameState,
    socketConnected,
    error,
    countdown,
    selectedAnswer,
    setSelectedAnswer,
    answerSubmitted,
    voteSubmitted,
    joinRoom,
    submitAnswer,
    submitVote,
    clearError,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
