// frontend/src/HostApp.tsx - Host-specific interface
import React, { useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import QRCode from 'qrcode';
import { soundManager } from './sounds';
import GroupGif from './Group.gif';
import PointGif from './point.gif';

interface Player {
  id: string;
  displayName: string;
  status: 'connected' | 'disconnected';
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
  isFake?: boolean;
  timer?: number;
  scores?: Array<{
    userId: string;
    displayName: string;
    score: number;
  }>;
  lastResult?: {
    fakeId: string;
    fakeCaught: boolean;
    fakeQuestion?: string;
  };
}

export interface HostAppProps {
  onGameStateChange?: (gameInProgress: boolean) => void;
}

interface GameSettings {
  answerTimer: number;
  discussionTimer: number;
  voteTimer: number;
  rounds: number;
  theme: 'default' | 'dark' | 'neon' | 'pastel';
  showPlayerNames: boolean;
  allowSpectators: boolean;
  fakePoints: number;
  groupPoints: number;
}

// Use relative URL for production, localhost for development
const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin;

function HostApp({ onGameStateChange }: HostAppProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [gameState, setGameState] = useState<GameState>({ state: 'landing' });
  const [error, setError] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);
  const [playerAnswers, setPlayerAnswers] = useState<Array<{
    playerId: string;
    playerName: string;
    answerId: string;
    answerName: string;
  }>>([]);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    answerTimer: 30,
    discussionTimer: 120,
    voteTimer: 15,
    rounds: 5,
    theme: 'default',
    showPlayerNames: true,
    allowSpectators: false,
    fakePoints: 3,
    groupPoints: 1
  });
  const [showTutorial, setShowTutorial] = useState<boolean>(false);

  // Countdown timer effect - sync with server
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Track game state changes to notify parent component
  useEffect(() => {
    if (onGameStateChange) {
      const gameInProgress = gameState.state !== 'landing' && gameState.state !== 'lobby';
      onGameStateChange(gameInProgress);
    }
  }, [gameState.state, onGameStateChange]);

  // Tutorial opens only via explicit user action (How to Play button)

  useEffect(() => {
    console.log('Connecting to socket at:', SOCKET_URL);
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });
    setSocket(newSocket);

    // Connection status handlers
    newSocket.on('connect', () => {
      console.log('Socket connected successfully');
      setSocketConnected(true);
      setError('');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setSocketConnected(false);
      setError(`Connection failed: ${err.message}`);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setSocketConnected(false);
      if (reason === 'io server disconnect') {
        setError('Connection lost. Please refresh the page.');
      }
    });

    newSocket.on('reconnect', () => {
      console.log('Socket reconnected');
      setSocketConnected(true);
      setError('');
    });

    // Socket event listeners
    newSocket.on('room:joined', (data) => {
      setGameState(prev => ({
        ...prev,
        state: 'lobby',
        room: { ...prev.room!, pin: data.pin }
      }));
    });

    newSocket.on('room:update', (data) => {
      console.log('Host received room:update:', data);
      setGameState(prev => {
        if (!prev.room) {
          console.warn('Received room:update but no room in state');
          return prev;
        }
        const oldPlayerCount = prev.room.players.length;
        const newPlayerCount = data.players?.length || 0;
        console.log(`Updating player list from ${oldPlayerCount} to ${newPlayerCount} players`);
        
        // Create a new array reference to ensure React detects the change
        const updatedPlayers = Array.isArray(data.players) ? [...data.players] : [];
        
        return {
          ...prev,
          room: { 
            ...prev.room, 
            players: updatedPlayers,
            pin: prev.room.pin // Preserve pin
          }
        };
      });
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
        isFake: false
      }));
    });

    newSocket.on('prompt:fake', (data) => {
      setGameState(prev => ({
        ...prev,
        currentQuestion: data.text,
        isFake: true
      }));
    });

    newSocket.on('answers:update', (data) => {
      setPlayerAnswers(data.answers);
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
      setCountdown(data.timer);
    });

    newSocket.on('round:result', (data) => {
      if (data.fakeCaught) {
        soundManager.playSuccess();
      } else {
        soundManager.playFailure();
      }
      setGameState(prev => ({
        ...prev,
        state: 'results',
        scores: data.scores,
        lastResult: {
          fakeId: data.fakeId,
          fakeCaught: data.fakeCaught,
          fakeQuestion: data.fakeQuestion
        }
      }));
      setCountdown(5); // Show results for 5 seconds
    });

    // Listen for server timer updates for synchronization
    newSocket.on('timer:update', (data) => {
      setCountdown(data.timeLeft);
    });

    newSocket.on('game:end', (data) => {
      setGameState(prev => ({
        ...prev,
        state: 'ended',
        scores: data.finalScores
      }));
    });

    newSocket.on('error', (data) => {
      setError(data.message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const createRoom = async () => {
    const userId = Math.random().toString(36).substring(7);
    const displayName = 'Host';
    
    if (!socketConnected) {
      setError('Not connected to server. Please wait...');
      return;
    }
    
    if (!socket) {
      setError('Socket not available. Please refresh the page.');
      return;
    }
    
    try {
      const response = await fetch(`${SOCKET_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: userId, displayName })
      });
      
      const data = await response.json();
      
      setGameState({
        state: 'lobby',
        user: { id: userId, displayName, isHost: true },
        room: { pin: data.pin, players: [] }
      });
      
      // Small delay to ensure room is fully created before host joins
      setTimeout(() => {
        console.log('Host joining room after creation delay:', data.pin);
        socket?.emit('room:host-join', { pin: data.pin, userId, displayName });
      }, 100);
    } catch (err) {
      setError('Failed to create room');
    }
  };

  const startGame = () => {
    if (gameState.room) {
      soundManager.playRoundStart();
      socket?.emit('game:start', { 
        pin: gameState.room.pin,
        settings: gameSettings
      });
    }
  };

  const updateSettings = (newSettings: Partial<GameSettings>) => {
    console.log('Updating settings:', newSettings);
    setGameSettings(prev => {
      const updated = { ...prev, ...newSettings };
      console.log('New settings:', updated);
      return updated;
    });
  };

  // Apply theme to document and broadcast to players
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', gameSettings.theme);
    console.log('Applied theme:', gameSettings.theme);
    
    // Broadcast theme to all players in the room
    if (socket && gameState.room) {
      socket.emit('theme:broadcast', { 
        pin: gameState.room.pin, 
        theme: gameSettings.theme 
      });
    }
  }, [gameSettings.theme, socket, gameState.room]);

  if (gameState.state === 'landing') {
    return (
      <>
        <HostLandingScreen 
          onCreateRoom={createRoom} 
          socketConnected={socketConnected} 
          error={error} 
          onShowTutorial={() => setShowTutorial(true)}
          showTutorial={showTutorial}
          onCloseTutorial={(dontShowAgain?: boolean) => {
            if (dontShowAgain) localStorage.setItem('hostTutorialSeen', 'true');
            setShowTutorial(false);
          }}
          tutorialPoints={{ fakePoints: gameSettings.fakePoints, groupPoints: gameSettings.groupPoints }}
        />
      </>
    );
  }

  if (gameState.state === 'lobby') {
    return (
      <>
        <HostLobbyScreen
          room={gameState.room!}
          user={gameState.user!}
          onStartGame={startGame}
          gameState={gameState}
          showSettings={showSettings}
          onToggleSettings={() => setShowSettings(!showSettings)}
          gameSettings={gameSettings}
          onUpdateSettings={updateSettings}
          onShowTutorial={() => setShowTutorial(true)}
          showTutorial={showTutorial}
          onCloseTutorial={(dontShowAgain?: boolean) => {
            if (dontShowAgain) localStorage.setItem('hostTutorialSeen', 'true');
            setShowTutorial(false);
          }}
          tutorialPoints={{ fakePoints: gameSettings.fakePoints, groupPoints: gameSettings.groupPoints }}
          socket={socket}
        />
      </>
    );
  }

  if (gameState.state === 'answering') {
    return (
      <HostAnswerScreen
        question={gameState.currentQuestion!}
        players={gameState.room!.players}
        timer={countdown}
        isFake={gameState.isFake!}
        playerAnswers={playerAnswers}
        room={gameState.room!}
        socket={socket}
      />
    );
  }

  if (gameState.state === 'discussing') {
    return (
      <HostDiscussionScreen
        players={gameState.room!.players}
        timer={countdown}
        playerAnswers={playerAnswers}
        question={gameState.currentQuestion!}
        room={gameState.room!}
        socket={socket}
        onSkipToVoting={() => {
          if (socket && gameState.room?.pin && gameState.user?.id) {
            socket.emit('discussion:skip-to-voting', { 
              pin: gameState.room.pin,
              hostId: gameState.user.id 
            });
          }
        }}
      />
    );
  }

  if (gameState.state === 'voting') {
    return (
      <HostVotingScreen
        players={gameState.room!.players}
        timer={countdown}
        room={gameState.room!}
        socket={socket}
      />
    );
  }

  if (gameState.state === 'results') {
    return (
      <HostResultsScreen
        scores={gameState.scores!}
        lastResult={gameState.lastResult!}
        players={gameState.room!.players}
        timer={countdown}
        room={gameState.room!}
      />
    );
  }

  if (gameState.state === 'ended') {
    return (
      <HostGameEndScreen
        finalScores={gameState.scores!}
        room={gameState.room!}
      />
    );
  }

  return <div>Loading...</div>;
}

// Host-specific components
function HostLandingScreen({ onCreateRoom, socketConnected, error, onShowTutorial, showTutorial, onCloseTutorial, tutorialPoints }: { onCreateRoom: () => void; socketConnected: boolean; error?: string; onShowTutorial: () => void; showTutorial?: boolean; onCloseTutorial?: (dontShowAgain?: boolean) => void; tutorialPoints?: { fakePoints: number; groupPoints: number } }) {
  return (
    <div className="screen">
      <div className="container">
        <h1 className="title">🎭 Fake Out</h1>
        
        <div className="host-badge">
          🖥️ Host Screen - Perfect for iPad/Laptop
        </div>
        
        {/* Connection Status */}
        <div className="connection-status" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
          {socketConnected ? (
            <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span>🟢</span>
              <span>Connected to server</span>
            </div>
          ) : (
            <div style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span>🟡</span>
              <span>Connecting to server...</span>
            </div>
          )}
        </div>
        
        {error && (
          <div className="waiting-message" style={{ marginTop: '1rem' }}>
            <p style={{ color: '#b91c1c' }}>⚠️ {error}</p>
          </div>
        )}
        
        <div className="host-setup">
          <button 
            onClick={() => {
              soundManager.playClick();
              onCreateRoom();
            }}
            className="button primary"
            disabled={!socketConnected}
          >
            {socketConnected ? 'Start a Game' : 'Connecting...'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HostLobbyScreen({ 
  room, 
  user, 
  onStartGame,
  gameState,
  showSettings,
  onToggleSettings,
  gameSettings,
  onUpdateSettings,
  onShowTutorial,
  showTutorial,
  onCloseTutorial,
  tutorialPoints,
  socket
}: { 
  room: { pin: string; players: Player[] };
  user: { isHost: boolean };
  onStartGame: () => void;
  gameState: GameState;
  showSettings: boolean;
  onToggleSettings: () => void;
  gameSettings: GameSettings;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
  onShowTutorial: () => void;
  showTutorial?: boolean;
  onCloseTutorial?: (dontShowAgain?: boolean) => void;
  tutorialPoints?: { fakePoints: number; groupPoints: number };
  socket?: Socket | null;
}) {
  return (
    <div className="screen">
      <div className="container">
        <div className="lobby-header">
          <div className="room-pin-display">
            <h2>Room PIN: {room.pin}</h2>
            <button 
              onClick={async () => {
                soundManager.playClick();
                try {
                  await navigator.clipboard.writeText(room.pin);
                  // You could add a toast notification here if you have one
                  console.log('PIN copied to clipboard');
                } catch (err) {
                  console.error('Failed to copy PIN:', err);
                }
              }}
              className="copy-pin-btn"
              title="Copy PIN to clipboard"
            >
              📋 Copy
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              onClick={() => {
                soundManager.toggle();
                soundManager.playClick();
              }}
              className="button secondary"
              title={soundManager.isEnabled() ? 'Disable sounds' : 'Enable sounds'}
            >
              {soundManager.isEnabled() ? '🔊' : '🔇'}
            </button>
            <button 
              onClick={() => {
                soundManager.playClick();
                onToggleSettings();
              }}
              className="button secondary settings-btn"
            >
              ⚙️ Game Settings
            </button>
            <button 
              onClick={() => {
                soundManager.playClick();
                onShowTutorial();
              }}
              className="button secondary"
            >
              ❓ How to Play
            </button>
          </div>
        </div>
        
        <div className="lobby-qr-section">
          <QRCodeDisplay roomPin={room.pin} />
        </div>
        
        <div className="host-info">
          <h3>🎮 Host: {gameState.user?.displayName}</h3>
        </div>
        
        {showSettings && (
          <GameSettingsPanel
            settings={gameSettings}
            onUpdateSettings={onUpdateSettings}
          />
        )}
        
        <div className="players-list">
          <h3>Players ({room.players.length})</h3>
          {room.players.map((player, index) => (
            <div key={player.id} className={`player-card ${player.status === 'disconnected' ? 'disconnected' : ''}`} style={{ '--i': index } as React.CSSProperties}>
              <div className="player-status-indicator">
                {player.status === 'connected' ? '🟢' : '🟡'}
              </div>
              <span className="player-name">{player.displayName}</span>
              {player.status === 'disconnected' && (
                <span className="disconnected-label">Disconnected</span>
              )}
              <button
                onClick={() => {
                  soundManager.playClick();
                  if (window.confirm(`Kick ${player.displayName} from the game?`)) {
                    socket?.emit('player:kick', { 
                      pin: room.pin, 
                      targetUserId: player.id 
                    });
                  }
                }}
                className="kick-player-btn"
                title={`Kick ${player.displayName}`}
              >
                🚪
              </button>
            </div>
          ))}
        </div>
        
        <button 
          onClick={onStartGame} 
          className="button primary"
          disabled={room.players.length < 3}
        >
          Start Game {room.players.length < 3 && '(Need 3+ players)'}
        </button>
        {showTutorial && onCloseTutorial && (
          <TutorialCarouselModal onClose={onCloseTutorial} fakePoints={tutorialPoints?.fakePoints} groupPoints={tutorialPoints?.groupPoints} />
        )}
      </div>
    </div>
  );
}

function HostAnswerScreen({
  question,
  players,
  timer,
  isFake,
  playerAnswers,
  room,
  socket
}: {
  question: string;
  players: Player[];
  timer: number;
  isFake: boolean;
  playerAnswers: Array<{
    playerId: string;
    playerName: string;
    answerId: string;
    answerName: string;
  }>;
  room?: { pin: string; players: Player[] };
  socket?: Socket | null;
}) {
  const isUrgent = timer <= 3;

  // Play sound effects for timer urgency
  useEffect(() => {
    if (timer > 0 && timer <= 3) {
      if (timer === 1) {
        soundManager.playTimerCritical(timer);
      } else if (timer === 2 || timer === 3) {
        soundManager.playTimerWarning(timer);
      }
    } else if (timer > 3) {
      soundManager.resetTimerSoundTracking();
    }
  }, [timer]);

  return (
    <div className="screen">
      <div className="container host-container">
        <div className={`host-top-bar ${isUrgent ? 'timer-urgent' : ''}`}>
          <div className="host-timer-left">
            <div className={`timer-display-small ${isUrgent ? 'timer-urgent-display' : ''}`}>{timer}</div>
            <div className="timer-label-small">SECONDS TO ANSWER</div>
          </div>
          <div className="host-pin-right">
            <div className="room-pin-display-small">PIN: {room?.pin}</div>
          </div>
        </div>
        
        <div className="players-overview">
          <h3>Players ({players.length})</h3>
          <div className="players-grid">
            {players.map((player, index) => {
              const answer = playerAnswers.find(a => a.playerId === player.id);
              return (
                <div key={player.id} className={`player-status ${player.status === 'disconnected' ? 'disconnected' : ''}`} style={{ '--i': index } as React.CSSProperties}>
                  <div className="player-avatar">👤</div>
                  <span>{player.displayName}</span>
                  <div className="connection-status">
                    {player.status === 'connected' ? '🟢' : '🟡'}
                  </div>
                  <div className="status-indicator">
                    {answer ? (
                      <span className="answer-status">✅ {answer.answerName}</span>
                    ) : (
                      <span className="waiting-status">⏳</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      if (window.confirm(`Kick ${player.displayName} from the game?`)) {
                        socket?.emit('player:kick', { 
                          pin: room?.pin, 
                          targetUserId: player.id 
                        });
                      }
                    }}
                    className="kick-player-btn"
                    title={`Kick ${player.displayName}`}
                  >
                    🚪
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
  question,
  onSkipToVoting,
  room,
  socket
}: {
  players: Player[];
  timer: number;
  playerAnswers: Array<{
    playerId: string;
    playerName: string;
    answerId: string;
    answerName: string;
  }>;
  question: string;
  onSkipToVoting?: () => void;
  room?: { pin: string; players: Player[] };
  socket?: Socket | null;
}) {
  const isUrgent = timer <= 3;

  // Play sound effects for timer urgency
  useEffect(() => {
    if (timer > 0 && timer <= 3) {
      if (timer === 1) {
        soundManager.playTimerCritical(timer);
      } else if (timer <= 3) {
        soundManager.playTimerWarning(timer);
      }
    } else if (timer > 3) {
      soundManager.resetTimerSoundTracking();
    }
  }, [timer]);

  return (
    <div className="screen">
      <div className="container host-container">
        <div className={`host-top-bar discussion-timer-section ${isUrgent ? 'timer-urgent' : ''}`}>
          <div className="host-timer-left">
            <div className={`timer-display-small ${isUrgent ? 'timer-urgent-display' : ''}`}>{timer}</div>
            <div className="timer-label-small">SECONDS TO DISCUSS</div>
          </div>
          <div className="host-pin-right">
            <div className="room-pin-display-small">PIN: {room?.pin}</div>
          </div>
        </div>
        
        <div className="discussion-overview">
          <h3>💬 Discussion in Progress</h3>
          <div className="question-display">
            <h4>Original Question:</h4>
            <p className="question-text">{question}</p>
          </div>
          <p>Players are discussing their answers and trying to figure out who the fake is!</p>
        </div>
        
        <div className="answers-summary">
          <h3>📝 Who Answered What</h3>
          <div className="answers-list-improved">
            {playerAnswers.map((answer, index) => (
              <div key={index} className="answer-row-improved">
                <span className="answer-player-name">{answer.playerName}</span>
                <span className="answer-arrow-improved">→</span>
                <span className="answer-target-name">{answer.answerName}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="players-overview">
          <h3>Players ({players.length})</h3>
          <div className="players-grid">
            {players.map((player, index) => (
              <div key={player.id} className="player-status" style={{ '--i': index } as React.CSSProperties}>
                <div className="player-avatar">👤</div>
                <span>{player.displayName}</span>
                <div className="status-indicator">💬</div>
                <button
                  onClick={() => {
                    soundManager.playClick();
                    if (window.confirm(`Kick ${player.displayName} from the game?`)) {
                      socket?.emit('player:kick', { 
                        pin: room?.pin, 
                        targetUserId: player.id 
                      });
                    }
                  }}
                  className="kick-player-btn"
                  title={`Kick ${player.displayName}`}
                >
                  🚪
                </button>
              </div>
            ))}
          </div>
        </div>
        
        <div className="host-actions">
          <button 
            className="skip-button host-skip-button"
            onClick={() => {
              soundManager.playClick();
              onSkipToVoting?.();
            }}
            title="Skip to voting phase if players are ready"
          >
            ⏭️ Skip to Voting
          </button>
        </div>
      </div>
    </div>
  );
}

function HostVotingScreen({
  players,
  timer,
  room,
  socket
}: {
  players: Player[];
  timer: number;
  room?: { pin: string; players: Player[] };
  socket?: Socket | null;
}) {
  const isUrgent = timer <= 3;

  // Play sound effects for timer urgency
  useEffect(() => {
    if (timer > 0 && timer <= 3) {
      if (timer === 1) {
        soundManager.playTimerCritical(timer);
      } else if (timer <= 3) {
        soundManager.playTimerWarning(timer);
      }
    } else if (timer > 3) {
      soundManager.resetTimerSoundTracking();
    }
  }, [timer]);

  return (
    <div className="screen">
      <div className="container host-container">
        <div className={`host-top-bar voting-timer-section ${isUrgent ? 'timer-urgent' : ''}`}>
          <div className="host-timer-left">
            <div className={`timer-display-small ${isUrgent ? 'timer-urgent-display' : ''}`}>{timer}</div>
            <div className="timer-label-small">SECONDS TO VOTE</div>
          </div>
          <div className="host-pin-right">
            <div className="room-pin-display-small">PIN: {room?.pin}</div>
          </div>
        </div>
        
        <div className="voting-overview">
          <h3>🗳️ Voting in Progress</h3>
          <p>Players are voting on who they think is the fake!</p>
        </div>
        
        <div className="players-overview">
          <h3>Players ({players.length})</h3>
          <div className="players-grid">
            {players.map((player, index) => (
              <div key={player.id} className="player-status" style={{ '--i': index } as React.CSSProperties}>
                <div className="player-avatar">👤</div>
                <span>{player.displayName}</span>
                <div className="status-indicator">🗳️</div>
                <button
                  onClick={() => {
                    soundManager.playClick();
                    if (window.confirm(`Kick ${player.displayName} from the game?`)) {
                      socket?.emit('player:kick', { 
                        pin: room?.pin, 
                        targetUserId: player.id 
                      });
                    }
                  }}
                  className="kick-player-btn"
                  title={`Kick ${player.displayName}`}
                >
                  🚪
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
  timer,
  room
}: {
  scores: Array<{ userId: string; displayName: string; score: number }>;
  lastResult: { fakeId: string; fakeCaught: boolean; fakeQuestion?: string };
  players: Player[];
  timer?: number;
  room?: { pin: string; players: Player[] };
}) {
  const fake = players.find(p => p.id === lastResult.fakeId);
  
  return (
    <div className="screen">
      <div className="container host-container">
        {timer && (
          <div className="host-top-bar">
            <div className="host-timer-left">
              <div className="timer-display-small">Next: {timer}s</div>
              <div className="timer-label-small">NEXT ROUND</div>
            </div>
            <div className="host-pin-right">
              <div className="room-pin-display-small">PIN: {room?.pin}</div>
            </div>
          </div>
        )}
        {!timer && (
          <div className="host-top-bar">
            <div className="host-pin-right" style={{ marginLeft: 'auto' }}>
              <div className="room-pin-display-small">PIN: {room?.pin}</div>
            </div>
          </div>
        )}
        
        <div className="result-reveal">
          <h3>The Fake Was:</h3>
          <div className="fake-reveal">
            <div className="fake-avatar">🎭</div>
            <span className="fake-name">{fake?.displayName}</span>
          </div>
          <p className={lastResult.fakeCaught ? 'success' : 'failure'}>
            {lastResult.fakeCaught ? '✅ Fake Caught!' : '❌ Fake Escaped!'}
          </p>
        </div>
        
        {lastResult.fakeQuestion && (
          <div className="fake-question-reveal">
            <h3>🎭 The Impostor's Question Was:</h3>
            <div className="fake-question-display">
              <p className="fake-question-text">{lastResult.fakeQuestion}</p>
            </div>
          </div>
        )}
        
        <div className="scores">
          <h3>📊 Current Leaderboard</h3>
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
  finalScores,
  room
}: {
  finalScores: Array<{ userId: string; displayName: string; score: number }>;
  room?: { pin: string; players: Player[] };
}) {
  return (
    <div className="screen">
      <div className="container">
        <div className="game-end-header">
          <h2>Game Over!</h2>
          {room && (
            <div className="room-pin-small">PIN: {room.pin}</div>
          )}
        </div>
        
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
          Play Again
        </button>
      </div>
    </div>
  );
}

// Game Settings Panel Component
function GameSettingsPanel({
  settings,
  onUpdateSettings
}: {
  settings: GameSettings;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
}) {
  return (
    <div className="settings-panel">
      <h3>🎮 Game Settings</h3>
      
      <div className="settings-grid">
        <div className="setting-group">
          <h4>⏱️ Timing</h4>
          <div className="setting-item">
            <label>Answer Time (seconds):</label>
            <input
              type="number"
              min="10"
              max="120"
              value={settings.answerTimer}
              onChange={(e) => onUpdateSettings({ answerTimer: parseInt(e.target.value) })}
              className="setting-input"
            />
          </div>
          <div className="setting-item">
            <label>Discussion Time (seconds):</label>
            <input
              type="number"
              min="30"
              max="300"
              value={settings.discussionTimer}
              onChange={(e) => onUpdateSettings({ discussionTimer: parseInt(e.target.value) })}
              className="setting-input"
            />
          </div>
          <div className="setting-item">
            <label>Voting Time (seconds):</label>
            <input
              type="number"
              min="5"
              max="60"
              value={settings.voteTimer}
              onChange={(e) => onUpdateSettings({ voteTimer: parseInt(e.target.value) })}
              className="setting-input"
            />
          </div>
        </div>

        <div className="setting-group">
          <h4>🎯 Game Rules</h4>
          <div className="setting-item">
            <label>Number of Rounds:</label>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.rounds}
              onChange={(e) => onUpdateSettings({ rounds: parseInt(e.target.value) })}
              className="setting-input"
            />
          </div>
          <div className="setting-item">
            <label>Fake Points (when not caught):</label>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.fakePoints}
              onChange={(e) => onUpdateSettings({ fakePoints: parseInt(e.target.value) })}
              className="setting-input"
            />
          </div>
          <div className="setting-item">
            <label>Group Points (when fake caught):</label>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.groupPoints}
              onChange={(e) => onUpdateSettings({ groupPoints: parseInt(e.target.value) })}
              className="setting-input"
            />
          </div>
        </div>

        <div className="setting-group">
          <h4>🎨 Appearance</h4>
          <div className="setting-item">
            <label>Theme: <span className="current-theme">({settings.theme})</span></label>
            <select
              value={settings.theme}
              onChange={(e) => {
                console.log('Theme changed to:', e.target.value);
                onUpdateSettings({ theme: e.target.value as GameSettings['theme'] });
              }}
              className="setting-select"
            >
              <option value="default">🌈 Default</option>
              <option value="dark">🌙 Dark</option>
              <option value="neon">⚡ Neon</option>
              <option value="pastel">🌸 Pastel</option>
            </select>
            <div className="theme-preview">
              <small>Preview: {settings.theme === 'default' && '🌈 Colorful gradients'} 
                     {settings.theme === 'dark' && '🌙 Dark mode'} 
                     {settings.theme === 'neon' && '⚡ Bright neon colors'} 
                     {settings.theme === 'pastel' && '🌸 Soft pastel colors'}</small>
            </div>
          </div>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.showPlayerNames}
                onChange={(e) => onUpdateSettings({ showPlayerNames: e.target.checked })}
              />
              Show Player Names
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.allowSpectators}
                onChange={(e) => onUpdateSettings({ allowSpectators: e.target.checked })}
              />
              Allow Spectators
            </label>
          </div>
        </div>
      </div>

      <div className="settings-presets">
        <h4>🚀 Quick Presets</h4>
        <div className="preset-buttons">
          <button 
            className="button secondary preset-btn"
            onClick={(e) => {
              e.preventDefault();
              onUpdateSettings({
                answerTimer: 15,
                discussionTimer: 60,
                voteTimer: 10,
                rounds: 3
              });
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            ⚡ Quick Game
          </button>
          <button 
            className="button secondary preset-btn"
            onClick={(e) => {
              e.preventDefault();
              onUpdateSettings({
                answerTimer: 45,
                discussionTimer: 180,
                voteTimer: 20,
                rounds: 7
              });
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🎯 Standard
          </button>
          <button 
            className="button secondary preset-btn"
            onClick={(e) => {
              e.preventDefault();
              onUpdateSettings({
                answerTimer: 60,
                discussionTimer: 300,
                voteTimer: 30,
                rounds: 10
              });
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🏆 Tournament
          </button>
        </div>
      </div>
    </div>
  );
}

// QR Code Component
function QRCodeDisplay({ roomPin }: { roomPin: string }) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        setIsLoading(true);
        // Generate the game URL with the room PIN - use production URL
        const gameUrl = `https://fakeout.fly.dev/?pin=${roomPin}`;
        
        // Generate QR code with high quality settings
        const qrCodeUrl = await QRCode.toDataURL(gameUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'M'
        });
        
        setQrCodeDataUrl(qrCodeUrl);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generateQRCode();
  }, [roomPin]);

  return (
    <div className="qr-code-section">
      <h3>📱 Players can scan to join:</h3>
      <div className="qr-code-container">
        {isLoading ? (
          <div className="qr-loading">
            <div className="loading-spinner"></div>
            <p>Generating QR code...</p>
          </div>
        ) : (
          <div className="qr-code-wrapper">
            <img 
              src={qrCodeDataUrl} 
              alt="QR Code to join game" 
              className="qr-code-image"
            />
            <p className="qr-instructions">
              Scan with your phone camera to join the game
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default HostApp;

// Visual slideshow tutorial component (mini presentation)
function TutorialCarouselModal({ onClose, fakePoints, groupPoints }: { onClose: (dontShowAgain?: boolean) => void; fakePoints?: number; groupPoints?: number }) {
  const [index, setIndex] = React.useState(0);
  const fp = typeof fakePoints === 'number' ? fakePoints : 3;
  const gp = typeof groupPoints === 'number' ? groupPoints : 1;

  const SlideLayout = ({
    title,
    description,
    children
  }: {
    title: React.ReactNode;
    description?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div
      style={{
        textAlign: 'center',
        minHeight: 480,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        padding: '24px 24px 16px'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 700 }}>{title}</div>
        {description && (
          <div style={{ fontSize: 16, color: '#475569', fontWeight: 500, maxWidth: 420 }}>{description}</div>
        )}
      </div>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>{children}</div>
      <div style={{ height: 1 }} />
    </div>
  );

  const Card = ({
    children,
    background = '#fff',
    minWidth = 220
  }: {
    children: React.ReactNode;
    background?: string;
    minWidth?: number;
  }) => (
    <div
      style={{
        padding: 24,
        borderRadius: 20,
        background,
        boxShadow: '0 10px 30px rgba(15,23,42,0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        minWidth
      }}
    >
      {children}
    </div>
  );

  const slides: Array<React.ReactNode> = [
    (
      <SlideLayout
        title="🎭 Fake Out"
        description="Spot the impostor. Don't get fooled."
      >
        <div style={{ display: 'flex', gap: 24 }}>
          <Card background="linear-gradient(135deg, #eef2ff, #e0e7ff)">
            <div style={{ fontSize: 48 }}>🖥️</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Host runs the game</div>
          </Card>
          <Card background="linear-gradient(135deg, #eef2ff, #e0e7ff)">
            <div style={{ fontSize: 48 }}>📱</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Players join on phones</div>
          </Card>
        </div>
      </SlideLayout>
    ),
    (
      <SlideLayout
        title="Create a Room & Share"
        description="Players scan or enter the PIN to join."
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Card>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>Room PIN</div>
            <div style={{ fontSize: 42, letterSpacing: 4, fontWeight: 700, color: '#0f172a' }}>1 2 3 4 5 6</div>
          </Card>
          <div style={{ fontSize: 56 }}>🔗</div>
          <Card>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>QR Code</div>
            <div style={{ width: 160, height: 160, background: 'linear-gradient(135deg, #e5e7eb, #cbd5e1)', borderRadius: 12 }} />
          </Card>
        </div>
      </SlideLayout>
    ),
    (
      <SlideLayout
        title="Answer Phase"
        description="Most players get the same question. One gets a different one!"
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
                boxShadow: '0 8px 24px rgba(102, 126, 234, 0.35)',
                border: '4px solid white'
              }}>👤</div>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
                boxShadow: '0 8px 24px rgba(102, 126, 234, 0.35)',
                border: '4px solid white'
              }}>👤</div>
            </div>
            <div style={{
              padding: '20px 24px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
              boxShadow: '0 6px 18px rgba(0,0,0,0.1)',
              maxWidth: 400,
              border: '2px solid #0ea5e9'
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0369a1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Group Question</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0c4a6e' }}>What's the best movie snack?</div>
            </div>
          </div>

          <div style={{ fontSize: 32, opacity: 0.6 }}>VS</div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
                boxShadow: '0 12px 28px rgba(245, 158, 11, 0.4)',
                border: '4px solid white',
                position: 'relative'
              }}>
                🎭
                <div style={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'white',
                  boxShadow: '0 6px 16px rgba(239, 68, 68, 0.55)'
                }}>!</div>
              </div>
            </div>
            <div style={{
              padding: '20px 24px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
              boxShadow: '0 6px 18px rgba(245, 158, 11, 0.2)',
              maxWidth: 400,
              border: '2px solid #f59e0b'
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#92400e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>🎭 Impostor Question</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#78350f' }}>What's your favorite pizza topping?</div>
            </div>
          </div>
        </div>
      </SlideLayout>
    ),
    (
      <SlideLayout
        title="Discuss"
        description="Talk it out, compare answers, and spot the person who doesn't quite line up. Host can skip straight to voting when the group is ready."
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img
            src={GroupGif}
            alt="Players discussing"
            style={{
              maxWidth: '100%',
              height: 'auto',
              borderRadius: 16,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              maxHeight: '300px'
            }}
          />
        </div>
      </SlideLayout>
    ),
    (
      <SlideLayout
        title="Vote & Score"
        description="Leaderboards update every round."
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <img
            src={PointGif}
            alt="Time to vote"
            style={{
              maxWidth: '100%',
              height: 'auto',
              borderRadius: 16,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              maxHeight: '250px'
            }}
          />
          <div style={{ fontSize: 18, color: '#0f172a', fontWeight: 600 }}>
            It's time to vote! Point out who you think is the impostor.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Card>
              <div style={{ fontSize: 18, marginBottom: 12, fontWeight: 600, color: '#0f172a' }}>Vote for the impostor</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e5e7eb', border: '3px solid #cbd5e1' }} />
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e5e7eb', border: '3px solid #cbd5e1' }} />
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e5e7eb', border: '3px solid #cbd5e1' }} />
              </div>
            </Card>
            <div style={{ fontSize: 48 }}>➡️</div>
            <Card>
              <div style={{ fontSize: 18, marginBottom: 12, fontWeight: 600, color: '#0f172a' }}>Scoring</div>
              <div style={{ fontSize: 16, marginBottom: 6, color: '#475569' }}>Impostor +{fp} if not caught</div>
              <div style={{ fontSize: 16, color: '#475569' }}>Group +{gp} if caught</div>
            </Card>
          </div>
        </div>
      </SlideLayout>
    )
  ];

  const isLast = index === slides.length - 1;

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="modal" style={{ background: 'var(--color-surface, #fff)', color: 'var(--color-text, #111)', borderRadius: 20, maxWidth: 920, width: '100%', padding: '1rem 1rem 0.75rem', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>How to Play</h3>
          <button className="button secondary" onClick={() => onClose()} title="Close">✖️</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflow: 'auto', padding: '0.5rem 0.25rem' }}>
          {slides[index]}
        </div>
        <div className="modal-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.5rem' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {slides.map((_, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: 6, background: i === index ? 'var(--color-primary, #3b82f6)' : '#d1d5db' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="button secondary" onClick={() => onClose(true)}>Don't show again</button>
            <button className="button secondary" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>Back</button>
            {!isLast && (
              <button className="button primary" onClick={() => setIndex(Math.min(slides.length - 1, index + 1))}>Next</button>
            )}
            {isLast && (
              <button className="button primary" onClick={() => onClose()}>Got it</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
