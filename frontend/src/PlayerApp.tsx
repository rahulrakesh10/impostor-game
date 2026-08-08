// frontend/src/PlayerApp.tsx - Player-specific interface
import React, { useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import { HowToPlayButton, HowToPlayModal } from './HowToPlay';
import { ErrorToast } from './ErrorToast';
import { SoundToggle } from './SoundToggle';
import { soundManager, useTimerSound } from './sounds';

interface Player {
  id: string;
  displayName: string;
}

interface GameState {
  state: 'landing' | 'lobby' | 'answering' | 'discussing' | 'voting' | 'results' | 'ended';
  room?: {
    pin: string;
    players: Player[];
  };
  user?: {
    id: string;
    displayName: string;
    isHost: boolean;
  };
  currentQuestion?: string;
  isImpostor?: boolean;
  timer?: number;
  scores?: Array<{
    userId: string;
    displayName: string;
    score: number;
  }>;
  lastResult?: {
    impostorId: string;
    impostorCaught: boolean;
  };
}

const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin;
const SESSION_KEY = 'impostor_player_session';

interface StoredSession {
  userId: string;
  displayName: string;
  pin: string;
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function PlayerApp() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [gameState, setGameState] = useState<GameState>({ state: 'landing' });
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);

  // Auto-dismiss error toasts
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });
    setSocket(newSocket);

    // Rejoin automatically on every connect - both the first connect and any
    // reconnect after the socket drops (e.g. phone screen locks, wifi blip)
    newSocket.on('connect', () => {
      setSocketConnected(true);
      const session = loadSession();
      if (session) {
        setGameState(prev => ({
          ...prev,
          user: prev.user ?? { id: session.userId, displayName: session.displayName, isHost: false },
          room: prev.room ?? { pin: session.pin, players: [] }
        }));
        newSocket.emit('room:join', {
          pin: session.pin,
          userId: session.userId,
          displayName: session.displayName
        });
      }
    });

    newSocket.on('connect_error', () => {
      setSocketConnected(false);
    });

    newSocket.on('disconnect', () => {
      setSocketConnected(false);
    });

    // Socket event listeners
    newSocket.on('room:joined', (data) => {
      setGameState(prev => ({
        ...prev,
        state: prev.state === 'landing' ? 'lobby' : prev.state,
        room: { ...prev.room!, pin: data.pin }
      }));
    });

    newSocket.on('room:sync', (data) => {
      setGameState(prev => ({
        ...prev,
        state: data.state,
        room: { ...prev.room!, players: data.players },
        // During discussion the question is only sent when the host chose to show it -
        // don't fall back to a stale value from the answering phase (could be the impostor's).
        currentQuestion: data.state === 'discussing' ? data.question : (data.question ?? prev.currentQuestion),
        isImpostor: data.isImpostor ?? prev.isImpostor,
        scores: data.scores ?? prev.scores,
        lastResult: data.lastResult ?? prev.lastResult
      }));
      if (data.hasAnswered || data.hasVoted) {
        setSelectedAnswer('');
      }
      setCountdown(data.timeLeft ?? 0);
    });

    newSocket.on('room:update', (data) => {
      setGameState(prev => ({
        ...prev,
        room: { ...prev.room!, players: data.players }
      }));
    });

    newSocket.on('round:start', (data) => {
      soundManager.resetTimerSoundTracking();
      soundManager.playRoundStart();
      setGameState(prev => ({
        ...prev,
        state: 'answering',
        timer: data.timer
      }));
      setSelectedAnswer('');
      setCountdown(data.timer);
    });

    newSocket.on('prompt:group', (data) => {
      setGameState(prev => ({
        ...prev,
        currentQuestion: data.text,
        isImpostor: false
      }));
    });

    newSocket.on('prompt:impostor', (data) => {
      setGameState(prev => ({
        ...prev,
        currentQuestion: data.text,
        isImpostor: !!data.revealed
      }));
    });

    newSocket.on('discussion:start', (data) => {
      setGameState(prev => ({
        ...prev,
        state: 'discussing',
        timer: data.timer,
        currentQuestion: data.question
      }));
      setCountdown(data.timer);
    });

    newSocket.on('voting:start', (data) => {
      setGameState(prev => ({
        ...prev,
        state: 'voting',
        timer: data.timer
      }));
      setSelectedAnswer('');
      setCountdown(data.timer);
    });

    newSocket.on('round:result', (data) => {
      if (data.impostorCaught) {
        soundManager.playSuccess();
      } else {
        soundManager.playFailure();
      }
      setGameState(prev => ({
        ...prev,
        state: 'results',
        scores: data.scores,
        lastResult: {
          impostorId: data.impostorId,
          impostorCaught: data.impostorCaught
        }
      }));
      setCountdown(5); // Show results for 5 seconds
    });

    newSocket.on('game:end', (data) => {
      clearSession();
      setGameState(prev => ({
        ...prev,
        state: 'ended',
        scores: data.finalScores
      }));
    });

    newSocket.on('error', (data) => {
      setError(data.message);
      // Stale session (room gone, game ended and cleaned up, etc.) - stop retrying it
      if (data.message === 'Room not found') {
        clearSession();
      }
    });

    newSocket.on('player:kicked', (data) => {
      clearSession();
      setError(data.message || 'You were dismissed from the case by the host');
      setGameState({ state: 'landing' });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const joinRoom = (pin: string, displayName: string) => {
    soundManager.playClick();
    const userId = Math.random().toString(36).substring(7);

    saveSession({ userId, displayName, pin });

    setGameState({
      state: 'lobby',
      user: { id: userId, displayName, isHost: false },
      room: { pin, players: [] }
    });

    socket?.emit('room:join', { pin, userId, displayName });
  };

  const submitAnswer = () => {
    if (selectedAnswer && gameState.room) {
      soundManager.playSubmit();
      socket?.emit('answer:submit', {
        pin: gameState.room.pin,
        targetUserId: selectedAnswer
      });
    }
  };

  const submitVote = () => {
    if (selectedAnswer && gameState.room) {
      soundManager.playSubmit();
      socket?.emit('vote:submit', {
        pin: gameState.room.pin,
        targetUserId: selectedAnswer
      });
    }
  };

  let screen: React.ReactNode;

  if (gameState.state === 'landing') {
    screen = <PlayerLandingScreen onJoinRoom={joinRoom} socketConnected={socketConnected} />;
  } else if (gameState.state === 'lobby') {
    screen = (
      <PlayerLobbyScreen
        room={gameState.room!}
        user={gameState.user!}
      />
    );
  } else if (gameState.state === 'answering') {
    screen = (
      <PlayerAnswerScreen
        question={gameState.currentQuestion!}
        isImpostor={gameState.isImpostor!}
        players={gameState.room!.players}
        selectedAnswer={selectedAnswer}
        onSelectAnswer={setSelectedAnswer}
        onSubmitAnswer={submitAnswer}
        timer={countdown}
      />
    );
  } else if (gameState.state === 'discussing') {
    screen = (
      <PlayerDiscussionScreen
        timer={countdown}
        question={gameState.currentQuestion}
      />
    );
  } else if (gameState.state === 'voting') {
    screen = (
      <PlayerVotingScreen
        players={gameState.room!.players}
        selectedVote={selectedAnswer}
        onSelectVote={setSelectedAnswer}
        onSubmitVote={submitVote}
        timer={countdown}
      />
    );
  } else if (gameState.state === 'results') {
    screen = (
      <PlayerResultsScreen
        scores={gameState.scores!}
        lastResult={gameState.lastResult!}
        players={gameState.room!.players}
        timer={countdown}
      />
    );
  } else if (gameState.state === 'ended') {
    screen = (
      <PlayerGameEndScreen
        finalScores={gameState.scores!}
      />
    );
  } else {
    screen = <div>Loading...</div>;
  }

  return (
    <>
      {!socketConnected && gameState.state !== 'landing' && (
        <div className="connection-banner">Reconnecting...</div>
      )}
      {error && <ErrorToast message={error} onDismiss={() => setError('')} />}
      {screen}
    </>
  );
}

// Player-specific components
function PlayerLandingScreen({ onJoinRoom, socketConnected }: { onJoinRoom: (pin: string, name: string) => void; socketConnected: boolean }) {
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState(() => new URLSearchParams(window.location.search).get('pin') || '');
  const [showBriefing, setShowBriefing] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !pin) return;
    onJoinRoom(pin, displayName);
  };

  return (
    <div className="screen">
      <div className="container">
        <h1 className="title">Who's the Impostor?</h1>

        <div className="player-badge">
          Suspect Intake
        </div>

        <div className="player-setup">
          <div className="join-instructions">
            <h3>Enter the Investigation</h3>
            <p>Get the case access code from the host screen</p>
          </div>

          <form onSubmit={handleSubmit} className="form">
            <input
              type="text"
              placeholder="Your alias"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input"
              required
            />

            <input
              type="text"
              placeholder="Case access code"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="input pin-input"
              required
              maxLength={6}
            />

            <button type="submit" className="button primary" disabled={!socketConnected}>
              {socketConnected ? 'Join Case' : 'Connecting...'}
            </button>
          </form>

          <div className="lobby-actions">
            <HowToPlayButton onClick={() => setShowBriefing(true)} />
            <SoundToggle />
          </div>
        </div>
      </div>

      {showBriefing && <HowToPlayModal onClose={() => setShowBriefing(false)} />}
    </div>
  );
}

function PlayerLobbyScreen({ 
  room, 
  user
}: { 
  room: { pin: string; players: Player[] };
  user: { isHost: boolean };
}) {
  return (
    <div className="screen">
      <div className="container">
        <div className="case-tag">Case #{room.pin}</div>
        <h2>Waiting Room</h2>

        <div className="players-list">
          <h3>Suspects ({room.players.length})</h3>
          {room.players.map(player => (
            <div key={player.id} className="player-card">
              {player.displayName}
            </div>
          ))}
        </div>

        <p>Waiting for the host to open the case...</p>
      </div>
    </div>
  );
}

function PlayerAnswerScreen({
  question,
  isImpostor,
  players,
  selectedAnswer,
  onSelectAnswer,
  onSubmitAnswer,
  timer
}: {
  question: string;
  isImpostor: boolean;
  players: Player[];
  selectedAnswer: string;
  onSelectAnswer: (id: string) => void;
  onSubmitAnswer: () => void;
  timer?: number;
}) {
  useTimerSound(timer);

  return (
    <div className="screen">
      <div className="container">
        {timer !== undefined && (
          <div className={`timer ${timer <= 3 ? 'urgent' : ''}`}>{timer}s</div>
        )}

        <div className={`question-container ${isImpostor ? 'impostor' : 'group'}`}>
          <h2>{question}</h2>
          {isImpostor && <div className="impostor-badge">Classified — You're the Impostor</div>}
        </div>

        <div className="players-grid">
          {players.map(player => (
            <button
              key={player.id}
              className={`player-button ${selectedAnswer === player.id ? 'selected' : ''}`}
              onClick={() => onSelectAnswer(player.id)}
            >
              {player.displayName}
            </button>
          ))}
        </div>

        <button
          onClick={onSubmitAnswer}
          className="button primary"
          disabled={!selectedAnswer}
        >
          Submit Statement
        </button>
      </div>
    </div>
  );
}

function PlayerDiscussionScreen({ timer, question }: { timer?: number; question?: string }) {
  return (
    <div className="screen">
      <div className="container">
        {timer !== undefined && <div className="timer">{timer}s</div>}
        <h2>Cross-Examination</h2>
        <p>Compare statements out loud. Someone's story won't add up.</p>

        {question && (
          <div className="question-container group">
            <h3>The question on file:</h3>
            <p className="question-text">{question}</p>
          </div>
        )}

        <div className="discussion-hint">
          Listen for the answer that doesn't quite fit the group's story. Ask your host to skip to voting once everyone's ready.
        </div>
      </div>
    </div>
  );
}

function PlayerVotingScreen({
  players,
  selectedVote,
  onSelectVote,
  onSubmitVote,
  timer
}: {
  players: Player[];
  selectedVote: string;
  onSelectVote: (id: string) => void;
  onSubmitVote: () => void;
  timer?: number;
}) {
  useTimerSound(timer);

  return (
    <div className="screen">
      <div className="container">
        {timer !== undefined && (
          <div className={`timer ${timer <= 3 ? 'urgent' : ''}`}>{timer}s</div>
        )}

        <h2>Cast Your Accusation</h2>

        <div className="players-grid">
          {players.map(player => (
            <button
              key={player.id}
              className={`player-button ${selectedVote === player.id ? 'selected' : ''}`}
              onClick={() => onSelectVote(player.id)}
            >
              {player.displayName}
            </button>
          ))}
        </div>

        <button
          onClick={onSubmitVote}
          className="button primary"
          disabled={!selectedVote}
        >
          Lock Accusation
        </button>
      </div>
    </div>
  );
}

function PlayerResultsScreen({
  scores,
  lastResult,
  players,
  timer
}: {
  scores: Array<{ userId: string; displayName: string; score: number }>;
  lastResult: { impostorId: string; impostorCaught: boolean };
  players: Player[];
  timer?: number;
}) {
  const impostor = players.find(p => p.id === lastResult.impostorId);
  
  return (
    <div className="screen">
      <div className="container">
        {timer !== undefined && <div className="timer">{timer}s</div>}
        <h2>Case Closed</h2>

        <div className="result-reveal">
          <h3>The impostor was</h3>
          <div className="impostor-reveal">
            <span className="impostor-name">{impostor?.displayName}</span>
          </div>
          <p className={lastResult.impostorCaught ? 'success' : 'failure'}>
            {lastResult.impostorCaught ? 'Caught' : 'Escaped'}
          </p>
        </div>

        <div className="scores">
          <h3>Standings</h3>
          {scores.sort((a, b) => b.score - a.score).map(player => (
            <div key={player.userId} className="score-row">
              <span>{player.displayName}</span>
              <span className="score">{player.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayerGameEndScreen({
  finalScores
}: {
  finalScores: Array<{ userId: string; displayName: string; score: number }>;
}) {
  return (
    <div className="screen">
      <div className="container">
        <h2>Case Closed for Good</h2>

        <div className="final-scores">
          {finalScores.map((player, index) => (
            <div key={player.userId} className={`score-row ${index === 0 ? 'winner' : ''}`}>
              <span className="rank">#{index + 1}</span>
              <span className="name">{player.displayName}</span>
              <span className="score">{player.score}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => window.location.reload()}
          className="button primary"
        >
          New Investigation
        </button>
      </div>
    </div>
  );
}

export default PlayerApp;
