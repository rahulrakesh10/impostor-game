// frontend/src/HostApp.tsx - Host-specific interface
import React, { useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import { HowToPlayButton, HowToPlayModal } from './HowToPlay';
import { QrJoinPanel } from './QrJoinPanel';
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
const SESSION_KEY = 'impostor_host_session';

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

function HostApp() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>({ state: 'landing' });
  const [error, setError] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);
  const [playerAnswers, setPlayerAnswers] = useState<Array<{
    playerId: string;
    playerName: string;
    answerId: string;
    answerName: string;
  }>>([]);

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
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // Rejoin automatically on every connect - both the first connect and any
    // reconnect after the socket drops (e.g. tab backgrounded, wifi blip)
    newSocket.on('connect', () => {
      const session = loadSession();
      if (session) {
        setGameState(prev => ({
          ...prev,
          user: prev.user ?? { id: session.userId, displayName: session.displayName, isHost: true },
          room: prev.room ?? { pin: session.pin, players: [] }
        }));
        newSocket.emit('room:host-join', {
          pin: session.pin,
          userId: session.userId,
          displayName: session.displayName
        });
      }
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
        scores: data.scores ?? prev.scores,
        lastResult: data.lastResult ?? prev.lastResult
      }));
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
      setCountdown(data.timer);
      setPlayerAnswers([]);
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
        isImpostor: true
      }));
    });

    newSocket.on('answers:update', (data) => {
      setPlayerAnswers(data.answers);
    });

    newSocket.on('discussion:start', (data) => {
      setGameState(prev => ({
        ...prev,
        state: 'discussing',
        timer: data.timer
      }));
      setCountdown(data.timer);
    });

    newSocket.on('voting:start', (data) => {
      setGameState(prev => ({
        ...prev,
        state: 'voting',
        timer: data.timer
      }));
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
      if (data.message === 'Room not found') {
        clearSession();
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const createRoom = async () => {
    soundManager.playClick();
    const userId = Math.random().toString(36).substring(7);
    const displayName = 'Host';
    
    try {
      const response = await fetch(`${SOCKET_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: userId, displayName })
      });
      
      const data = await response.json();

      saveSession({ userId, displayName, pin: data.pin });

      setGameState({
        state: 'lobby',
        user: { id: userId, displayName, isHost: true },
        room: { pin: data.pin, players: [] }
      });

      // Host connects but doesn't join as a player
      socket?.emit('room:host-join', { pin: data.pin, userId, displayName });
    } catch (err) {
      setError('Failed to create room');
    }
  };

  const startGame = () => {
    soundManager.playClick();
    if (gameState.room) {
      socket?.emit('game:start', { pin: gameState.room.pin });
    }
  };

  const kickPlayer = (playerId: string, displayName: string) => {
    soundManager.playClick();
    if (!gameState.room) return;
    if (!window.confirm(`Dismiss ${displayName} from the case?`)) return;
    socket?.emit('player:kick', { pin: gameState.room.pin, targetUserId: playerId });
  };

  let screen: React.ReactNode;

  if (gameState.state === 'landing') {
    screen = <HostLandingScreen onCreateRoom={createRoom} />;
  } else if (gameState.state === 'lobby') {
    screen = (
      <HostLobbyScreen
        room={gameState.room!}
        user={gameState.user!}
        onStartGame={startGame}
        onKickPlayer={kickPlayer}
        gameState={gameState}
      />
    );
  } else if (gameState.state === 'answering') {
    screen = (
      <HostAnswerScreen
        question={gameState.currentQuestion!}
        players={gameState.room!.players}
        timer={countdown}
        isImpostor={gameState.isImpostor!}
        playerAnswers={playerAnswers}
        onKickPlayer={kickPlayer}
      />
    );
  } else if (gameState.state === 'discussing') {
    screen = (
      <HostDiscussionScreen
        players={gameState.room!.players}
        timer={countdown}
        playerAnswers={playerAnswers}
        onKickPlayer={kickPlayer}
      />
    );
  } else if (gameState.state === 'voting') {
    screen = (
      <HostVotingScreen
        players={gameState.room!.players}
        timer={countdown}
        onKickPlayer={kickPlayer}
      />
    );
  } else if (gameState.state === 'results') {
    screen = (
      <HostResultsScreen
        scores={gameState.scores!}
        lastResult={gameState.lastResult!}
        players={gameState.room!.players}
        timer={countdown}
      />
    );
  } else if (gameState.state === 'ended') {
    screen = (
      <HostGameEndScreen
        finalScores={gameState.scores!}
      />
    );
  } else {
    screen = <div>Loading...</div>;
  }

  return (
    <>
      {error && <ErrorToast message={error} onDismiss={() => setError('')} />}
      {screen}
    </>
  );
}

// Host-specific components
function HostLandingScreen({ onCreateRoom }: { onCreateRoom: () => void }) {
  const [showBriefing, setShowBriefing] = useState(false);

  return (
    <div className="screen">
      <div className="container">
        <h1 className="title">Who's the Impostor?</h1>

        <div className="host-badge">
          Case Command — Best on a Larger Screen
        </div>

        <div className="host-setup">
          <button
            onClick={onCreateRoom}
            className="button primary"
          >
            Open a New Case
          </button>
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

function HostLobbyScreen({
  room,
  user,
  onStartGame,
  onKickPlayer,
  gameState
}: {
  room: { pin: string; players: Player[] };
  user: { isHost: boolean };
  onStartGame: () => void;
  onKickPlayer: (playerId: string, displayName: string) => void;
  gameState: GameState;
}) {
  const [showBriefing, setShowBriefing] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPin = async () => {
    soundManager.playClick();
    try {
      await navigator.clipboard.writeText(room.pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied — the PIN is already visible on screen either way
    }
  };

  return (
    <div className="screen">
      <div className="container">
        <div className="lobby-actions">
          <HowToPlayButton onClick={() => setShowBriefing(true)} />
          <SoundToggle />
        </div>

        <h2>Waiting Room</h2>

        <div className="pin-display">
          <span className="pin-value">{room.pin}</span>
          <button className="copy-button" onClick={copyPin} type="button">
            {copied ? 'Copied' : 'Copy Code'}
          </button>
        </div>

        <QrJoinPanel pin={room.pin} />

        <div className="host-info">
          <h3>Investigator: {gameState.user?.displayName}</h3>
        </div>

        <div className="players-list">
          <h3>Suspects ({room.players.length})</h3>
          {room.players.map(player => (
            <div key={player.id} className="player-card">
              <span>{player.displayName}</span>
              <button
                className="kick-button"
                onClick={() => onKickPlayer(player.id, player.displayName)}
                title={`Dismiss ${player.displayName}`}
                type="button"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={onStartGame}
          className="button primary"
          disabled={room.players.length < 3}
        >
          {room.players.length < 3 ? 'Need 3+ Suspects' : 'Open the Case'}
        </button>
      </div>

      {showBriefing && <HowToPlayModal onClose={() => setShowBriefing(false)} />}
    </div>
  );
}

function HostAnswerScreen({
  question,
  players,
  timer,
  isImpostor,
  playerAnswers,
  onKickPlayer
}: {
  question: string;
  players: Player[];
  timer: number;
  isImpostor: boolean;
  playerAnswers: Array<{
    playerId: string;
    playerName: string;
    answerId: string;
    answerName: string;
  }>;
  onKickPlayer: (playerId: string, displayName: string) => void;
}) {
  useTimerSound(timer);

  return (
    <div className="screen">
      <div className="container host-container">
        <div className={`big-timer ${timer <= 3 ? 'urgent' : ''}`}>
          <div className="timer-display">{timer}</div>
          <div className="timer-label">SECONDS TO ANSWER</div>
        </div>
        
        <div className="host-header">
          <h2>Answering Phase</h2>
          <div className="phase-info">
            <span className="phase-badge">Statements in progress</span>
          </div>
        </div>

        <div className={`question-container ${isImpostor ? 'impostor' : 'group'}`}>
          <h3>The question on file:</h3>
          <p className="question-text">{question}</p>
          {isImpostor && <div className="impostor-badge">Impostor Question</div>}
        </div>

        <div className="players-overview">
          <h3>Suspects ({players.length})</h3>
          <div className="players-grid">
            {players.map(player => {
              const answer = playerAnswers.find(a => a.playerId === player.id);
              return (
                <div key={player.id} className="player-status">
                  <div className="player-avatar">{player.displayName.charAt(0).toUpperCase()}</div>
                  <span>{player.displayName}</span>
                  <div className="status-indicator">
                    {answer ? (
                      <span className="answer-status">{answer.answerName}</span>
                    ) : (
                      <span className="waiting-status">Pending</span>
                    )}
                  </div>
                  <button
                    className="kick-button"
                    onClick={() => onKickPlayer(player.id, player.displayName)}
                    title={`Dismiss ${player.displayName}`}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HostDiscussionScreen({
  players,
  timer,
  playerAnswers,
  onKickPlayer
}: {
  players: Player[];
  timer: number;
  playerAnswers: Array<{
    playerId: string;
    playerName: string;
    answerId: string;
    answerName: string;
  }>;
  onKickPlayer: (playerId: string, displayName: string) => void;
}) {
  useTimerSound(timer);

  return (
    <div className="screen">
      <div className="container host-container">
        <div className={`big-timer discussion-timer ${timer <= 3 ? 'urgent' : ''}`}>
          <div className="timer-display">{timer}</div>
          <div className="timer-label">SECONDS TO DISCUSS</div>
        </div>
        
        <div className="host-header">
          <h2>Cross-Examination</h2>
          <div className="phase-info">
            <span className="phase-badge">Suspects are discussing</span>
          </div>
        </div>

        <div className="discussion-overview">
          <h3>Discussion in Progress</h3>
          <p>Suspects compare statements out loud, trying to spot who doesn't fit.</p>
        </div>

        <div className="answers-summary">
          <h3>Statements on Record</h3>
          <div className="answers-grid">
            {playerAnswers.map((answer, index) => (
              <div key={index} className="answer-item">
                <span className="player-name">{answer.playerName}</span>
                <span className="answer-arrow">→</span>
                <span className="answer-target">{answer.answerName}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="players-overview">
          <h3>Suspects ({players.length})</h3>
          <div className="players-grid">
            {players.map(player => (
              <div key={player.id} className="player-status">
                <div className="player-avatar">{player.displayName.charAt(0).toUpperCase()}</div>
                <span>{player.displayName}</span>
                <div className="status-indicator waiting-status">In discussion</div>
                <button
                  className="kick-button"
                  onClick={() => onKickPlayer(player.id, player.displayName)}
                  title={`Dismiss ${player.displayName}`}
                  type="button"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HostVotingScreen({
  players,
  timer,
  onKickPlayer
}: {
  players: Player[];
  timer: number;
  onKickPlayer: (playerId: string, displayName: string) => void;
}) {
  useTimerSound(timer);

  return (
    <div className="screen">
      <div className="container host-container">
        <div className={`big-timer voting-timer ${timer <= 3 ? 'urgent' : ''}`}>
          <div className="timer-display">{timer}</div>
          <div className="timer-label">SECONDS TO VOTE</div>
        </div>
        
        <div className="host-header">
          <h2>Final Accusations</h2>
          <div className="phase-info">
            <span className="phase-badge">Votes are being cast</span>
          </div>
        </div>

        <div className="voting-overview">
          <h3>Voting in Progress</h3>
          <p>Every suspect is casting their accusation.</p>
        </div>

        <div className="players-overview">
          <h3>Suspects ({players.length})</h3>
          <div className="players-grid">
            {players.map(player => (
              <div key={player.id} className="player-status">
                <div className="player-avatar">{player.displayName.charAt(0).toUpperCase()}</div>
                <span>{player.displayName}</span>
                <div className="status-indicator waiting-status">Voting</div>
                <button
                  className="kick-button"
                  onClick={() => onKickPlayer(player.id, player.displayName)}
                  title={`Dismiss ${player.displayName}`}
                  type="button"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HostResultsScreen({
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
      <div className="container host-container">
        {timer !== undefined && <div className="timer">{timer}s</div>}

        <div className="host-header">
          <h2>Case Closed</h2>
          <div className="phase-info">
            <span className="phase-badge">Round complete</span>
          </div>
        </div>

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
          <h3>Leaderboard</h3>
          {scores.sort((a, b) => b.score - a.score).map((player, index) => (
            <div key={player.userId} className={`score-row ${index === 0 ? 'winner' : ''}`}>
              <span className="rank">#{index + 1}</span>
              <span className="name">{player.displayName}</span>
              <span className="score">{player.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HostGameEndScreen({
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

export default HostApp;
