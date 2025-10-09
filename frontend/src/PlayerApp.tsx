// frontend/src/PlayerApp.tsx - Player-specific interface
import React, { useState, useEffect, useRef } from 'react';
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

export interface PlayerAppProps {
  onGameStateChange?: (gameInProgress: boolean) => void;
}

// Use relative URL for production, localhost for development
const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin;

function PlayerApp({ onGameStateChange }: PlayerAppProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [gameState, setGameState] = useState<GameState>({ state: 'landing' });
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);
  const [answerSubmitted, setAnswerSubmitted] = useState<boolean>(false);
  const [voteSubmitted, setVoteSubmitted] = useState<boolean>(false);
  const [currentTheme, setCurrentTheme] = useState<string>('default');
  const joinContext = useRef<{ userId: string; displayName: string; pin: string } | null>(null);

  // Remove local ticking; countdown is driven by server 'timer:update'

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    console.log('Applied theme to player:', currentTheme);
  }, [currentTheme]);

  // Track game state changes to notify parent component
  useEffect(() => {
    if (onGameStateChange) {
      const gameInProgress = gameState.state !== 'landing' && gameState.state !== 'lobby';
      onGameStateChange(gameInProgress);
    }
  }, [gameState.state, onGameStateChange]);

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
      const ctx = joinContext.current;
      setError('');
      setGameState(prev => ({
        ...prev,
        state: 'lobby',
        user: ctx ? { id: ctx.userId, displayName: ctx.displayName, isHost: false } : prev.user,
        room: { pin: data.pin, players: [] }
      }));
    });

    newSocket.on('room:update', (data) => {
      setGameState(prev => {
        const pin = prev.room?.pin || joinContext.current?.pin || '';
        const mergedRoom = prev.room
          ? { ...prev.room, players: data.players }
          : { pin, players: data.players };
        return { ...prev, room: mergedRoom };
      });
    });

    newSocket.on('round:start', (data) => {
      setGameState(prev => ({
        ...prev,
        state: 'answering',
        timer: data.timer
      }));
      setSelectedAnswer('');
      setCountdown(data.timer);
      setAnswerSubmitted(false);
      setVoteSubmitted(false);
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
      setVoteSubmitted(false);
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

    // Listen for theme updates from host
    newSocket.on('theme:update', (data) => {
      console.log('Theme update received:', data.theme);
      setCurrentTheme(data.theme);
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
      setGameState(prev => ({ ...prev, state: 'landing' }));
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const joinRoom = (pin: string, displayName: string, retryCount = 0) => {
    const userId = Math.random().toString(36).substring(7);
    setError('');
    joinContext.current = { userId, displayName, pin };
    
    if (!socketConnected) {
      setError('Not connected to server. Please wait...');
      return;
    }
    
    if (!socket) {
      setError('Socket not available. Please refresh the page.');
      return;
    }
    
    console.log(`Joining room: ${pin} as: ${displayName} (attempt ${retryCount + 1})`);
    socket.emit('room:join', { pin, userId, displayName });
    // In case of slow network/reconnects, proactively identify after connect
    socket.emit('user:identify', { userId, pin });
    
    // If room not found and this is the first attempt, retry after a short delay
    if (retryCount === 0) {
      const retryTimeout = setTimeout(() => {
        if (gameState.state === 'landing') {
          console.log('Retrying room join after delay...');
          joinRoom(pin, displayName, 1);
        }
      }, 2000);
      
      // Clear timeout if we successfully join
      const originalOnRoomJoined = socket.listeners('room:joined')[0];
      socket.once('room:joined', () => {
        clearTimeout(retryTimeout);
      });
    }
  };

  const submitAnswer = () => {
    if (selectedAnswer && gameState.room) {
      console.log('Submitting answer:', selectedAnswer);
      socket?.emit('answer:submit', { 
        pin: gameState.room.pin, 
        targetUserId: selectedAnswer 
      });
      setAnswerSubmitted(true);
    }
  };

  const submitVote = () => {
    if (selectedAnswer && gameState.room) {
      console.log('Submitting vote:', selectedAnswer);
      socket?.emit('vote:submit', { 
        pin: gameState.room.pin, 
        targetUserId: selectedAnswer 
      });
      setVoteSubmitted(true);
    }
  };

  if (gameState.state === 'landing') {
    return <PlayerLandingScreen onJoinRoom={joinRoom} error={error} socketConnected={socketConnected} />;
  }

  if (gameState.state === 'lobby') {
    return (
      <PlayerLobbyScreen 
        room={gameState.room!}
        user={gameState.user!}
      />
    );
  }

  if (gameState.state === 'answering') {
    if (answerSubmitted) {
      return (
        <AnswerConfirmationScreen
          timer={countdown}
          selectedAnswer={selectedAnswer}
          players={gameState.room!.players}
        />
      );
    }
    return (
      <PlayerAnswerScreen
        question={gameState.currentQuestion!}
        isFake={gameState.isFake!}
        players={gameState.room!.players}
        selectedAnswer={selectedAnswer}
        onSelectAnswer={setSelectedAnswer}
        onSubmitAnswer={submitAnswer}
        timer={countdown}
        playerName={gameState.user?.displayName}
      />
    );
  }

  if (gameState.state === 'discussing') {
    return (
      <PlayerDiscussionScreen
        timer={countdown}
        playerName={gameState.user?.displayName}
        question={gameState.currentQuestion!}
      />
    );
  }

  if (gameState.state === 'voting') {
    if (voteSubmitted) {
      return (
        <VoteConfirmationScreen
          timer={countdown}
          selectedVote={selectedAnswer}
          players={gameState.room!.players}
        />
      );
    }
    return (
      <PlayerVotingScreen
        players={gameState.room!.players}
        selectedVote={selectedAnswer}
        onSelectVote={setSelectedAnswer}
        onSubmitVote={submitVote}
        timer={countdown}
        playerName={gameState.user?.displayName}
      />
    );
  }

  if (gameState.state === 'results') {
    return (
      <PlayerResultsScreen
        scores={gameState.scores!}
        lastResult={gameState.lastResult!}
        players={gameState.room!.players}
        timer={countdown}
      />
    );
  }

  if (gameState.state === 'ended') {
    return (
      <PlayerGameEndScreen
        finalScores={gameState.scores!}
      />
    );
  }

  return <div>Loading...</div>;
}

// Player-specific components
function PlayerLandingScreen({ onJoinRoom, error, socketConnected }: { onJoinRoom: (pin: string, name: string) => void; error?: string; socketConnected: boolean }) {
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !pin) return;
    onJoinRoom(pin, displayName);
  };

  return (
    <div className="screen">
      <div className="container">
        <h1 className="title">Fake Out</h1>
        
        <div className="player-badge">
          📱 Player Screen - Perfect for Phone
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
        
        <div className="player-setup">
          <div className="join-instructions">
            <h3>Join the Game!</h3>
            <p>Enter the game PIN from the host screen</p>
          </div>
          
          <form onSubmit={handleSubmit} className="form">
            <input
              type="text"
              placeholder="Your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input"
              required
            />
            
            <input
              type="text"
              placeholder="Game PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="input pin-input"
              required
              maxLength={6}
            />
            
            <button 
              type="submit" 
              className="button primary"
              disabled={!socketConnected}
            >
              {socketConnected ? 'Join Game' : 'Connecting...'}
            </button>
          </form>
        </div>
      </div>
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
        <h2>Room PIN: {room.pin}</h2>
        
        <div className="players-list">
          <h3>Players ({room.players.length})</h3>
          {room.players.map(player => (
            <div key={player.id} className="player-card">
              {player.displayName}
            </div>
          ))}
        </div>
        
        <p>Waiting for host to start the game...</p>
      </div>
    </div>
  );
}

function PlayerAnswerScreen({
  question,
  isFake,
  players,
  selectedAnswer,
  onSelectAnswer,
  onSubmitAnswer,
  timer,
  playerName
}: {
  question: string;
  isFake: boolean;
  players: Player[];
  selectedAnswer: string;
  onSelectAnswer: (id: string) => void;
  onSubmitAnswer: () => void;
  timer?: number;
  playerName?: string;
}) {
  return (
    <div className="screen">
      <div className="container">
        {/* Player name in top right corner */}
        {playerName && (
          <div className="player-name-corner">
            👤 {playerName}
          </div>
        )}
        
        {timer && <div className="timer">Time: {timer}s</div>}
        
        <div className={`question-container ${isFake ? 'fake' : 'group'}`}>
          <h2>{question}</h2>
          {/* Hide fake badge during answering so fake doesn't know they have different question */}
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
          Submit Answer
        </button>
      </div>
    </div>
  );
}

function PlayerDiscussionScreen({ 
  timer, 
  playerName,
  question
}: { 
  timer?: number;
  playerName?: string;
  question: string;
}) {
  return (
    <div className="screen">
      <div className="container">
        {/* Player name in top right corner */}
        {playerName && (
          <div className="player-name-corner">
            👤 {playerName}
          </div>
        )}
        
        {timer && <div className="timer discussion-timer">Discussion Time: {timer}s</div>}
        
        <div className="discussion-content">
          <h2>Discussion Phase</h2>
          
          <div className="question-display">
            <h3>Original Question:</h3>
            <p className="question-text">{question}</p>
          </div>
          
          <p className="discussion-instruction">
            Discuss your answers and try to figure out who the fake is!
          </p>
          
          <div className="discussion-tips">
            <div className="discussion-tip">
              💡 Listen carefully to how others explain their choices
            </div>
            <div className="discussion-tip">
              🕵️ Look for inconsistencies in their reasoning
            </div>
            <div className="discussion-tip">
              🤔 Ask follow-up questions to test their knowledge
            </div>
          </div>
          
          <div className="discussion-note">
            <p>💬 Ask your host to skip to voting when everyone is ready!</p>
          </div>
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
  timer,
  playerName
}: {
  players: Player[];
  selectedVote: string;
  onSelectVote: (id: string) => void;
  onSubmitVote: () => void;
  timer?: number;
  playerName?: string;
}) {
  return (
    <div className="screen">
      <div className="container">
        {/* Player name in top right corner */}
        {playerName && (
          <div className="player-name-corner">
            👤 {playerName}
          </div>
        )}
        
        {timer && <div className="timer voting-timer">Voting Time: {timer}s</div>}
        
        <h2>Who is the fake?</h2>
        
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
          Vote
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
  lastResult: { fakeId: string; fakeCaught: boolean };
  players: Player[];
  timer?: number;
}) {
  const fake = players.find(p => p.id === lastResult.fakeId);
  
  return (
    <div className="screen">
      <div className="container">
        {timer && <div className="timer">Next Round: {timer}s</div>}
        <h2>Round Results</h2>
        
        <div className="result-reveal">
          <p>The fake was: <strong>{fake?.displayName}</strong></p>
          <p className={lastResult.fakeCaught ? 'success' : 'failure'}>
            {lastResult.fakeCaught ? '✅ Fake caught!' : '❌ Fake escaped!'}
          </p>
        </div>
        
        <div className="scores">
          <h3>Current Scores</h3>
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

// Confirmation Screen Components
function AnswerConfirmationScreen({
  timer,
  selectedAnswer,
  players
}: {
  timer: number;
  selectedAnswer: string;
  players: Player[];
}) {
  const selectedPlayer = players.find(p => p.id === selectedAnswer);
  
  return (
    <div className="screen">
      <div className="container">
        {timer && <div className="timer">Time: {timer}s</div>}
        
        <div className="confirmation-screen">
          <div className="confirmation-icon">✅</div>
          <h2>Answer Submitted!</h2>
          <p>Your answer has been saved successfully.</p>
          
          <div className="selected-answer-display">
            <h3>You selected:</h3>
            <div className="selected-player">
              {selectedPlayer?.displayName}
            </div>
          </div>
          
          <div className="waiting-message">
            <p>⏳ Waiting for other players to submit their answers...</p>
            <p>Discussion will begin when the timer runs out.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function VoteConfirmationScreen({
  timer,
  selectedVote,
  players
}: {
  timer: number;
  selectedVote: string;
  players: Player[];
}) {
  const selectedPlayer = players.find(p => p.id === selectedVote);
  
  return (
    <div className="screen">
      <div className="container">
        {timer && <div className="timer">Time: {timer}s</div>}
        
        <div className="confirmation-screen">
          <div className="confirmation-icon">🗳️</div>
          <h2>Vote Submitted!</h2>
          <p>Your vote has been recorded successfully.</p>
          
          <div className="selected-answer-display">
            <h3>You voted for:</h3>
            <div className="selected-player">
              {selectedPlayer?.displayName}
            </div>
          </div>
          
          <div className="waiting-message">
            <p>⏳ Waiting for other players to vote...</p>
            <p>Results will be shown when the timer runs out.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlayerApp;
