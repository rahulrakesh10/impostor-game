// frontend/src/HostApp.tsx - Host-specific interface
import React, { useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';

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
const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';

function HostApp({ onGameStateChange }: HostAppProps) {
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

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // Socket event listeners
    newSocket.on('room:joined', (data) => {
      setGameState(prev => ({
        ...prev,
        state: 'lobby',
        room: { ...prev.room!, pin: data.pin }
      }));
    });

    newSocket.on('room:update', (data) => {
      setGameState(prev => ({
        ...prev,
        room: { ...prev.room!, players: data.players }
      }));
    });

    newSocket.on('round:start', (data) => {
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
      setGameState(prev => ({
        ...prev,
        state: 'results',
        scores: data.scores,
        lastResult: {
          fakeId: data.fakeId,
          fakeCaught: data.fakeCaught
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
      
      // Host connects but doesn't join as a player
      socket?.emit('room:host-join', { pin: data.pin, userId, displayName });
    } catch (err) {
      setError('Failed to create room');
    }
  };

  const startGame = () => {
    if (gameState.room) {
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
    return <HostLandingScreen onCreateRoom={createRoom} />;
  }

  if (gameState.state === 'lobby') {
    return (
      <HostLobbyScreen
        room={gameState.room!}
        user={gameState.user!}
        onStartGame={startGame}
        gameState={gameState}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        gameSettings={gameSettings}
        onUpdateSettings={updateSettings}
      />
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
      />
    );
  }

  if (gameState.state === 'voting') {
    return (
      <HostVotingScreen
        players={gameState.room!.players}
        timer={countdown}
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
      />
    );
  }

  if (gameState.state === 'ended') {
    return (
      <HostGameEndScreen
        finalScores={gameState.scores!}
      />
    );
  }

  return <div>Loading...</div>;
}

// Host-specific components
function HostLandingScreen({ onCreateRoom }: { onCreateRoom: () => void }) {
  return (
    <div className="screen">
      <div className="container">
        <h1 className="title">Fake Out</h1>
        
        <div className="host-badge">
          🖥️ Host Screen - Perfect for iPad/Laptop
        </div>
        
        <div className="host-setup">
          <button 
            onClick={onCreateRoom} 
            className="button primary"
          >
            Start a Game
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
  onUpdateSettings
}: { 
  room: { pin: string; players: Player[] };
  user: { isHost: boolean };
  onStartGame: () => void;
  gameState: GameState;
  showSettings: boolean;
  onToggleSettings: () => void;
  gameSettings: GameSettings;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
}) {
  return (
    <div className="screen">
      <div className="container">
        <div className="lobby-header">
          <h2>Room PIN: {room.pin}</h2>
          <button 
            onClick={onToggleSettings}
            className="button secondary settings-btn"
          >
            ⚙️ Game Settings
          </button>
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
          {room.players.map(player => (
            <div key={player.id} className="player-card">
              {player.displayName}
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
      </div>
    </div>
  );
}

function HostAnswerScreen({
  question,
  players,
  timer,
  isFake,
  playerAnswers
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
}) {
  return (
    <div className="screen">
      <div className="container host-container">
        <div className="big-timer">
          <div className="timer-display">{timer}</div>
          <div className="timer-label">SECONDS TO ANSWER</div>
        </div>
        
        <div className="host-header">
          <h2>🎮 Host View - Answering Phase</h2>
          <div className="phase-info">
            <span className="phase-badge">Players are answering...</span>
          </div>
        </div>
        
        <div className={`question-container ${isFake ? 'fake' : 'group'}`}>
          <h3>Current Question:</h3>
          <p className="question-text">{question}</p>
          {isFake && <div className="fake-badge">Fake Question</div>}
        </div>
        
        <div className="players-overview">
          <h3>Players ({players.length})</h3>
          <div className="players-grid">
            {players.map(player => {
              const answer = playerAnswers.find(a => a.playerId === player.id);
              return (
                <div key={player.id} className="player-status">
                  <div className="player-avatar">👤</div>
                  <span>{player.displayName}</span>
                  <div className="status-indicator">
                    {answer ? (
                      <span className="answer-status">✅ {answer.answerName}</span>
                    ) : (
                      <span className="waiting-status">⏳</span>
                    )}
                  </div>
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
  question
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
}) {
  return (
    <div className="screen">
      <div className="container host-container">
        <div className="big-timer discussion-timer">
          <div className="timer-display">{timer}</div>
          <div className="timer-label">SECONDS TO DISCUSS</div>
        </div>
        
        <div className="host-header">
          <h2>🎮 Host View - Discussion Phase</h2>
          <div className="phase-info">
            <span className="phase-badge">Players are discussing...</span>
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
          <h3>📝 Player Answers</h3>
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
          <h3>Players ({players.length})</h3>
          <div className="players-grid">
            {players.map(player => (
              <div key={player.id} className="player-status">
                <div className="player-avatar">👤</div>
                <span>{player.displayName}</span>
                <div className="status-indicator">💬</div>
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
  timer
}: {
  players: Player[];
  timer: number;
}) {
  return (
    <div className="screen">
      <div className="container host-container">
        <div className="big-timer voting-timer">
          <div className="timer-display">{timer}</div>
          <div className="timer-label">SECONDS TO VOTE</div>
        </div>
        
        <div className="host-header">
          <h2>🎮 Host View - Voting Phase</h2>
          <div className="phase-info">
            <span className="phase-badge">Players are voting...</span>
          </div>
        </div>
        
        <div className="voting-overview">
          <h3>🗳️ Voting in Progress</h3>
          <p>Players are voting on who they think is the fake!</p>
        </div>
        
        <div className="players-overview">
          <h3>Players ({players.length})</h3>
          <div className="players-grid">
            {players.map(player => (
              <div key={player.id} className="player-status">
                <div className="player-avatar">👤</div>
                <span>{player.displayName}</span>
                <div className="status-indicator">🗳️</div>
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
  lastResult: { fakeId: string; fakeCaught: boolean };
  players: Player[];
  timer?: number;
}) {
  const fake = players.find(p => p.id === lastResult.fakeId);
  
  return (
    <div className="screen">
      <div className="container host-container">
        {timer && <div className="timer">Next Round: {timer}s</div>}
        
        <div className="host-header">
          <h2>🎮 Host View - Round Results</h2>
          <div className="phase-info">
            <span className="phase-badge">Round Complete!</span>
          </div>
        </div>
        
        <div className="result-reveal">
          <h3>🎭 The Fake Was:</h3>
          <div className="fake-reveal">
            <div className="fake-avatar">🎭</div>
            <span className="fake-name">{fake?.displayName}</span>
          </div>
          <p className={lastResult.fakeCaught ? 'success' : 'failure'}>
            {lastResult.fakeCaught ? '✅ Fake Caught!' : '❌ Fake Escaped!'}
          </p>
        </div>
        
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
  finalScores
}: {
  finalScores: Array<{ userId: string; displayName: string; score: number }>;
}) {
  return (
    <div className="screen">
      <div className="container">
        <h2>Game Over!</h2>
        
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
              console.log('Current settings:', settings);
              alert(`Current theme: ${settings.theme}\nAnswer timer: ${settings.answerTimer}s\nRounds: ${settings.rounds}`);
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🔍 Test Settings
          </button>
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

export default HostApp;
