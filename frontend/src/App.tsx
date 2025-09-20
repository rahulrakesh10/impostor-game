// frontend/src/App.tsx
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

const SOCKET_URL = 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>({ state: 'landing' });
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);
  const [isHostScreen, setIsHostScreen] = useState<boolean>(false);
  const [playerAnswers, setPlayerAnswers] = useState<Array<{
    playerId: string;
    playerName: string;
    answerId: string;
    answerName: string;
  }>>([]);

  // Screen size detection for host vs player screens
  useEffect(() => {
    const checkScreenSize = () => {
      const isLargeScreen = window.innerWidth >= 768; // Tablet/laptop size
      setIsHostScreen(isLargeScreen);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

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
      setSelectedAnswer('');
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
      setSelectedAnswer('');
      setCountdown(data.timer);
    });

    newSocket.on('round:result', (data) => {
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

  const createRoom = async (displayName: string) => {
    const userId = Math.random().toString(36).substring(7);
    
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
      
      socket?.emit('room:join', { pin: data.pin, userId, displayName });
    } catch (err) {
      setError('Failed to create room');
    }
  };

  const joinRoom = (pin: string, displayName: string) => {
    const userId = Math.random().toString(36).substring(7);
    
    setGameState({
      state: 'lobby',
      user: { id: userId, displayName, isHost: false },
      room: { pin, players: [] }
    });
    
    socket?.emit('room:join', { pin, userId, displayName });
  };

  const startGame = () => {
    if (gameState.room) {
      socket?.emit('game:start', { pin: gameState.room.pin });
    }
  };

  const submitAnswer = () => {
    if (selectedAnswer && gameState.room) {
      socket?.emit('answer:submit', { 
        pin: gameState.room.pin, 
        targetUserId: selectedAnswer 
      });
    }
  };

  const submitVote = () => {
    if (selectedAnswer && gameState.room) {
      socket?.emit('vote:submit', { 
        pin: gameState.room.pin, 
        targetUserId: selectedAnswer 
      });
    }
  };

  if (gameState.state === 'landing') {
    return <LandingScreen onCreateRoom={createRoom} onJoinRoom={joinRoom} isHostScreen={isHostScreen} />;
  }

  if (gameState.state === 'lobby') {
    return (
      <LobbyScreen 
        room={gameState.room!}
        user={gameState.user!}
        onStartGame={startGame}
        isHostScreen={isHostScreen}
        gameState={gameState}
      />
    );
  }

  if (gameState.state === 'answering') {
    if (isHostScreen) {
      return (
        <HostAnswerScreen
          question={gameState.currentQuestion!}
          players={gameState.room!.players}
          timer={countdown}
          isImpostor={gameState.isImpostor!}
          playerAnswers={playerAnswers}
        />
      );
    }
    return (
      <AnswerScreen
        question={gameState.currentQuestion!}
        isImpostor={gameState.isImpostor!}
        players={gameState.room!.players}
        selectedAnswer={selectedAnswer}
        onSelectAnswer={setSelectedAnswer}
        onSubmitAnswer={submitAnswer}
        timer={countdown}
      />
    );
  }

  if (gameState.state === 'discussing') {
    if (isHostScreen) {
      return (
        <HostDiscussionScreen
          players={gameState.room!.players}
          timer={countdown}
          playerAnswers={playerAnswers}
        />
      );
    }
    return (
      <DiscussionScreen
        timer={countdown}
      />
    );
  }

  if (gameState.state === 'voting') {
    if (isHostScreen) {
      return (
        <HostVotingScreen
          players={gameState.room!.players}
          timer={countdown}
        />
      );
    }
    return (
      <VotingScreen
        players={gameState.room!.players}
        selectedVote={selectedAnswer}
        onSelectVote={setSelectedAnswer}
        onSubmitVote={submitVote}
        timer={countdown}
      />
    );
  }

  if (gameState.state === 'results') {
    if (isHostScreen) {
      return (
        <HostResultsScreen
          scores={gameState.scores!}
          lastResult={gameState.lastResult!}
          players={gameState.room!.players}
          timer={countdown}
        />
      );
    }
    return (
      <ResultsScreen
        scores={gameState.scores!}
        lastResult={gameState.lastResult!}
        players={gameState.room!.players}
        timer={countdown}
      />
    );
  }

  if (gameState.state === 'ended') {
    return (
      <GameEndScreen
        finalScores={gameState.scores!}
      />
    );
  }

  return <div>Loading...</div>;
}

// Component implementations
function LandingScreen({ 
  onCreateRoom, 
  onJoinRoom,
  isHostScreen
}: { 
  onCreateRoom: (name: string) => void;
  onJoinRoom: (pin: string, name: string) => void;
  isHostScreen: boolean;
}) {
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName) return;
    
    if (mode === 'create') {
      // Create room
      onCreateRoom(displayName);
    } else {
      // Join room with PIN
      if (!pin) return;
      onJoinRoom(pin, displayName);
    }
  };

  return (
    <div className="screen">
      <div className="container">
        <h1 className="title">Who's the Impostor?</h1>
        
        {isHostScreen && (
          <div className="host-badge">
            🖥️ Host Screen - Perfect for iPad/Laptop
          </div>
        )}
        
        {!isHostScreen && (
          <div className="player-badge">
            📱 Player Screen - Perfect for Phone
          </div>
        )}
        
        <div className="mode-selector">
          <button 
            className={mode === 'create' ? 'active' : ''} 
            onClick={() => setMode('create')}
          >
            {isHostScreen ? 'Host Game' : 'Create Room'}
          </button>
          <button 
            className={mode === 'join' ? 'active' : ''} 
            onClick={() => setMode('join')}
          >
            Join Game
          </button>
        </div>

        {mode === 'create' ? (
          <div className="host-setup">
            {isHostScreen ? (
              <button 
                onClick={() => onCreateRoom('Host')} 
                className="button primary"
              >
                Start a Game
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="form">
                <input
                  type="text"
                  placeholder="Your display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input"
                  required
                />
                
                <button type="submit" className="button primary">
                  Create Room
                </button>
              </form>
            )}
          </div>
        ) : (
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
              
              <button type="submit" className="button primary">
                Join Game
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function LobbyScreen({ 
  room, 
  user, 
  onStartGame,
  isHostScreen,
  gameState
}: { 
  room: { pin: string; players: Player[] };
  user: { isHost: boolean };
  onStartGame: () => void;
  isHostScreen: boolean;
  gameState: GameState;
}) {
  return (
    <div className="screen">
      <div className="container">
        <h2>Room PIN: {room.pin}</h2>
        
        {isHostScreen && (
          <div className="host-info">
            <h3>🎮 Host: {gameState.user?.displayName}</h3>
          </div>
        )}
        
        <div className="players-list">
          <h3>Players ({room.players.filter(p => p.id !== gameState.user?.id).length})</h3>
          {room.players
            .filter(player => player.id !== gameState.user?.id) // Hide host from players list
            .map(player => (
              <div key={player.id} className="player-card">
                {player.displayName}
              </div>
            ))}
        </div>
        
        {user.isHost && (
          <button 
            onClick={onStartGame} 
            className="button primary"
            disabled={room.players.filter(p => p.id !== gameState.user?.id).length < 3}
          >
            Start Game {room.players.filter(p => p.id !== gameState.user?.id).length < 3 && '(Need 3+ players)'}
          </button>
        )}
        
        {!user.isHost && (
          <p>Waiting for host to start the game...</p>
        )}
      </div>
    </div>
  );
}

function AnswerScreen({
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
  return (
    <div className="screen">
      <div className="container">
        {timer && <div className="timer">Time: {timer}s</div>}
        
        <div className={`question-container ${isImpostor ? 'impostor' : 'group'}`}>
          <h2>{question}</h2>
          {isImpostor && <div className="impostor-badge">You are the impostor!</div>}
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

function DiscussionScreen({ timer }: { timer?: number }) {
  return (
    <div className="screen">
      <div className="container">
        {timer && <div className="timer">Discussion Time: {timer}s</div>}
        <h2>Discussion Phase</h2>
        <p>Discuss your answers and try to figure out who the impostor is!</p>
        <div className="discussion-hint">
          💡 Listen carefully to how others explain their choices
        </div>
      </div>
    </div>
  );
}

function VotingScreen({
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
  return (
    <div className="screen">
      <div className="container">
        {timer && <div className="timer">Voting Time: {timer}s</div>}
        
        <h2>Who is the impostor?</h2>
        
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

function ResultsScreen({
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
        {timer && <div className="timer">Next Round: {timer}s</div>}
        <h2>Round Results</h2>
        
        <div className="result-reveal">
          <p>The impostor was: <strong>{impostor?.displayName}</strong></p>
          <p className={lastResult.impostorCaught ? 'success' : 'failure'}>
            {lastResult.impostorCaught ? '✅ Impostor caught!' : '❌ Impostor escaped!'}
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

function GameEndScreen({
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

// Host Screen Components
function HostAnswerScreen({
  question,
  players,
  timer,
  isImpostor,
  playerAnswers
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
        
        <div className={`question-container ${isImpostor ? 'impostor' : 'group'}`}>
          <h3>Current Question:</h3>
          <p className="question-text">{question}</p>
          {isImpostor && <div className="impostor-badge">Impostor Question</div>}
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
  playerAnswers
}: {
  players: Player[];
  timer: number;
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
          <p>Players are discussing their answers and trying to figure out who the impostor is!</p>
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
          <p>Players are voting on who they think is the impostor!</p>
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
  lastResult: { impostorId: string; impostorCaught: boolean };
  players: Player[];
  timer?: number;
}) {
  const impostor = players.find(p => p.id === lastResult.impostorId);
  
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
          <h3>🎭 The Impostor Was:</h3>
          <div className="impostor-reveal">
            <div className="impostor-avatar">🎭</div>
            <span className="impostor-name">{impostor?.displayName}</span>
          </div>
          <p className={lastResult.impostorCaught ? 'success' : 'failure'}>
            {lastResult.impostorCaught ? '✅ Impostor Caught!' : '❌ Impostor Escaped!'}
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

export default App;