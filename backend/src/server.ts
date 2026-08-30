// backend/src/server.ts
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

// Types
interface User {
  id: string;
  displayName: string;
  socketId: string;
}

interface Room {
  id: string;
  pin: string;
  hostUserId: string;
  players: Map<string, User>;
  settings: {
    rounds: number;
    answerTimer: number;
    discussionTimer: number;
    voteTimer: number;
    showQuestionDuringDiscussion: boolean;
    revealImpostorRole: boolean;
  };
  state: 'lobby' | 'answering' | 'discussing' | 'voting' | 'results' | 'ended';
  currentRound: number;
  currentRoundData?: {
    impostorId: string;
    groupQuestion: string;
    impostorQuestion: string;
    answers: Map<string, string>;
    votes: Map<string, string>;
  };
  discussionTimeout?: NodeJS.Timeout;
  lastRoundResult?: {
    impostorId: string;
    impostorCaught: boolean;
    votes: Array<[string, string]>;
    scores: Array<{ userId: string; displayName: string; score: number }>;
  };
  phaseEndsAt?: number;
  scores: Map<string, number>;
}

interface Question {
  id: string;
  text: string;
  tags?: string[];
}

// Comprehensive question bank, grouped by category via tags (see getRandomQuestionPair)
const SAMPLE_QUESTIONS: Question[] = [
  // Personality & Humor
  { id: '1', text: 'Who is the funniest?', tags: ['personality', 'humor'] },
  { id: '2', text: 'Who is the most serious?', tags: ['personality', 'humor'] },
  { id: '3', text: 'Who tells the best jokes?', tags: ['personality', 'humor'] },
  { id: '4', text: 'Who tells the worst jokes?', tags: ['personality', 'humor'] },
  { id: '5', text: 'Who laughs the loudest?', tags: ['personality', 'humor'] },
  { id: '6', text: 'Who laughs the quietest?', tags: ['personality', 'humor'] },
  { id: '7', text: 'Who has the most contagious laugh?', tags: ['personality', 'humor'] },
  { id: '8', text: 'Who has the most awkward laugh?', tags: ['personality', 'humor'] },
  { id: '9', text: 'Who makes awkward situations funny?', tags: ['personality', 'humor'] },
  { id: '10', text: 'Who makes funny situations awkward?', tags: ['personality', 'humor'] },

  // School / Work
  { id: '11', text: 'Who is the most hardworking?', tags: ['school', 'work'] },
  { id: '12', text: 'Who is the laziest?', tags: ['school', 'work'] },
  { id: '13', text: 'Who procrastinates the most?', tags: ['school', 'work'] },
  { id: '14', text: 'Who always finishes things early?', tags: ['school', 'work'] },
  { id: '15', text: 'Who is most likely to forget homework?', tags: ['school', 'work'] },
  { id: '16', text: 'Who never forgets anything?', tags: ['school', 'work'] },
  { id: '17', text: 'Who gives the best presentations?', tags: ['school', 'work'] },
  { id: '18', text: 'Who is most afraid of public speaking?', tags: ['school', 'work'] },
  { id: '19', text: 'Who would be the best teacher?', tags: ['school', 'work'] },
  { id: '20', text: 'Who would be the worst teacher?', tags: ['school', 'work'] },

  // Everyday Life
  { id: '21', text: 'Who is the most organized?', tags: ['lifestyle'] },
  { id: '22', text: 'Who is the messiest?', tags: ['lifestyle'] },
  { id: '23', text: 'Who is the best cook?', tags: ['lifestyle'] },
  { id: '24', text: 'Who burns water when cooking?', tags: ['lifestyle'] },
  { id: '25', text: 'Who is most likely to oversleep?', tags: ['lifestyle'] },
  { id: '26', text: 'Who is always the first one awake?', tags: ['lifestyle'] },
  { id: '27', text: 'Who spends the most time on their phone?', tags: ['lifestyle'] },
  { id: '28', text: 'Who uses their phone the least?', tags: ['lifestyle'] },

  // Social Life
  { id: '29', text: 'Who is the most talkative?', tags: ['social'] },
  { id: '30', text: 'Who is the quietest?', tags: ['social'] },
  { id: '31', text: 'Who gives the best advice?', tags: ['social'] },
  { id: '32', text: 'Who gives the worst advice?', tags: ['social'] },
  { id: '33', text: 'Who is the best listener?', tags: ['social'] },
  { id: '34', text: 'Who interrupts people the most?', tags: ['social'] },
  { id: '35', text: 'Who is the life of the party?', tags: ['social'] },
  { id: '36', text: 'Who leaves parties first?', tags: ['social'] },

  // Adventure & Risk
  { id: '37', text: 'Who would survive a zombie apocalypse?', tags: ['adventure'] },
  { id: '38', text: 'Who would be first eliminated in a zombie apocalypse?', tags: ['adventure'] },
  { id: '39', text: 'Who would get lost on a trip?', tags: ['adventure'] },
  { id: '40', text: 'Who has the best sense of direction?', tags: ['adventure'] },
  { id: '41', text: 'Who would try the weirdest food?', tags: ['adventure'] },
  { id: '42', text: 'Who is the pickiest eater?', tags: ['adventure'] },
  { id: '43', text: 'Who is most likely to go skydiving?', tags: ['adventure'] },
  { id: '44', text: 'Who is most afraid of heights?', tags: ['adventure'] },
  { id: '45', text: 'Who is the most spontaneous?', tags: ['adventure'] },
  { id: '46', text: 'Who plans everything in advance?', tags: ['adventure'] },

  // Entertainment
  { id: '47', text: 'Who knows the most about movies?', tags: ['entertainment'] },
  { id: '48', text: 'Who has seen the fewest movies?', tags: ['entertainment'] },
  { id: '49', text: 'Who is most likely to binge-watch a show in one day?', tags: ['entertainment'] },
  { id: '50', text: 'Who watches the least TV?', tags: ['entertainment'] },
  { id: '51', text: 'Who is the biggest gamer?', tags: ['entertainment'] },
  { id: '52', text: 'Who has never touched a video game?', tags: ['entertainment'] },
  { id: '53', text: 'Who sings the loudest in the car?', tags: ['entertainment'] },
  { id: '54', text: 'Who refuses to sing along?', tags: ['entertainment'] },
  { id: '55', text: 'Who always picks the best music?', tags: ['entertainment'] },
  { id: '56', text: 'Who has the worst taste in music?', tags: ['entertainment'] },

  // Embarrassing / Silly
  { id: '57', text: 'Who trips the most?', tags: ['silly'] },
  { id: '58', text: 'Who has the best balance?', tags: ['silly'] },
  { id: '59', text: 'Who forgets names the most?', tags: ['silly'] },
  { id: '60', text: 'Who remembers everyone\'s name?', tags: ['silly'] },
  { id: '61', text: 'Who laughs at their own jokes the most?', tags: ['silly'] },
  { id: '62', text: 'Who never finds their own jokes funny?', tags: ['silly'] },
  { id: '63', text: 'Who takes the longest selfies?', tags: ['silly'] },
  { id: '64', text: 'Who hates taking photos?', tags: ['silly'] },
  { id: '65', text: 'Who is most likely to say something embarrassing in public?', tags: ['silly'] },
  { id: '66', text: 'Who thinks before they speak?', tags: ['silly'] },

  // Relationships & Personality
  { id: '67', text: 'Who is the most romantic?', tags: ['personality'] },
  { id: '68', text: 'Who is the least romantic?', tags: ['personality'] },
  { id: '69', text: 'Who gives the best compliments?', tags: ['personality'] },
  { id: '70', text: 'Who never compliments anyone?', tags: ['personality'] },
  { id: '71', text: 'Who is the most competitive?', tags: ['personality'] },
  { id: '72', text: 'Who doesn\'t care about winning?', tags: ['personality'] },
  { id: '73', text: 'Who is the most dramatic?', tags: ['personality'] },
  { id: '74', text: 'Who is the most chill?', tags: ['personality'] },

  // Misc / Random
  { id: '75', text: 'Who would be the best president/leader?', tags: ['random'] },
  { id: '76', text: 'Who would be the worst leader?', tags: ['random'] },
  { id: '77', text: 'Who is most likely to move abroad?', tags: ['random'] },
  { id: '78', text: 'Who will never leave their hometown?', tags: ['random'] },
  { id: '79', text: 'Who is most likely to become famous?', tags: ['random'] },
  { id: '80', text: 'Who prefers to stay anonymous?', tags: ['random'] },
  { id: '81', text: 'Who is the most creative?', tags: ['random'] },
  { id: '82', text: 'Who thinks inside the box?', tags: ['random'] },
  { id: '83', text: 'Who is the best problem-solver?', tags: ['random'] },
  { id: '84', text: 'Who creates more problems than they solve?', tags: ['random'] },
  { id: '85', text: 'Who would win a trivia contest?', tags: ['random'] },
  { id: '86', text: 'Who knows the least random facts?', tags: ['random'] },
  { id: '87', text: 'Who is the best dancer?', tags: ['random'] },
  { id: '88', text: 'Who has two left feet?', tags: ['random'] },
  { id: '89', text: 'Who would be a stand-up comedian?', tags: ['random'] },
  { id: '90', text: 'Who would bomb on stage?', tags: ['random'] },
  { id: '91', text: 'Who is the best at keeping secrets?', tags: ['random'] },
  { id: '92', text: 'Who can\'t keep a secret to save their life?', tags: ['random'] },
  { id: '93', text: 'Who would survive without the internet the longest?', tags: ['random'] },
  { id: '94', text: 'Who would die without WiFi?', tags: ['random'] },
];

// In-memory storage (replace with Redis in production)
const rooms = new Map<string, Room>();
const userSockets = new Map<string, string>(); // userId -> socketId
const disconnectTimeouts = new Map<string, NodeJS.Timeout>(); // userId -> pending removal timeout

// How long a disconnected player has to reconnect (e.g. phone screen lock) before being removed
const RECONNECT_GRACE_MS = 30000;

// Hard cap on players per room
const MAX_PLAYERS = 10;

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ["https://fakeout.fly.dev"]
      : "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Generate unique 6-digit PIN
function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Group the bank by its first tag, so a round's two questions come from the same
// topic (the impostor can still follow along) without being a fixed, designed
// pair of opposites. Categories with fewer than 2 questions can't form a pair.
const QUESTIONS_BY_CATEGORY: Question[][] = Array.from(
  SAMPLE_QUESTIONS.reduce((byCategory, q) => {
    const category = q.tags?.[0] ?? 'misc';
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(q);
    return byCategory;
  }, new Map<string, Question[]>()).values()
).filter(list => list.length >= 2);

// Get a random question pair for a round: a random category, two distinct random
// questions from it, then a random coin flip for which one the impostor gets.
function getRandomQuestionPair(): { group: Question; impostor: Question } {
  const pool = QUESTIONS_BY_CATEGORY[Math.floor(Math.random() * QUESTIONS_BY_CATEGORY.length)];

  const firstIndex = Math.floor(Math.random() * pool.length);
  let secondIndex = Math.floor(Math.random() * (pool.length - 1));
  if (secondIndex >= firstIndex) secondIndex++;

  const [a, b] = [pool[firstIndex], pool[secondIndex]];
  return Math.random() < 0.5 ? { group: a, impostor: b } : { group: b, impostor: a };
}

// REST API Routes
app.post('/api/rooms', (req, res) => {
  const { hostId, displayName } = req.body;
  
  if (!hostId || !displayName) {
    return res.status(400).json({ error: 'Missing hostId or displayName' });
  }

  const roomId = uuidv4();
  const pin = generatePin();
  
  const room: Room = {
    id: roomId,
    pin,
    hostUserId: hostId,
    players: new Map(),
    settings: {
      rounds: 5,
      answerTimer: 30,
      discussionTimer: 120,
      voteTimer: 15,
      showQuestionDuringDiscussion: true,
      revealImpostorRole: true
    },
    state: 'lobby',
    currentRound: 0,
    scores: new Map()
  };
  
  rooms.set(pin, room);
  
  res.json({ roomId, pin });
});

app.get('/api/rooms/:pin', (req, res) => {
  const { pin } = req.params;
  const room = rooms.get(pin);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const players = Array.from(room.players.values()).map(p => ({
    id: p.id,
    displayName: p.displayName
  }));
  
  res.json({
    id: room.id,
    pin: room.pin,
    players,
    state: room.state,
    settings: room.settings
  });
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('room:join', (data) => {
    const { pin, userId, displayName } = data;
    const room = rooms.get(pin);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Reconnecting player (e.g. phone screen locked and dropped the socket)
    if (room.players.has(userId)) {
      reconnectPlayer(room, userId, socket);
      return;
    }

    if (room.state !== 'lobby') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    if (room.players.size >= MAX_PLAYERS) {
      socket.emit('error', { message: `Room is full (max ${MAX_PLAYERS} players)` });
      return;
    }

    const user: User = { id: userId, displayName, socketId: socket.id };
    room.players.set(userId, user);
    room.scores.set(userId, 0);
    userSockets.set(userId, socket.id);

    socket.join(pin);

    // Broadcast updated player list
    const players = Array.from(room.players.values()).map(p => ({
      id: p.id,
      displayName: p.displayName
    }));

    io.to(pin).emit('room:update', { players, state: room.state });
    socket.emit('room:joined', { roomId: room.id, pin });
  });

  socket.on('room:host-join', (data) => {
    const { pin, userId, displayName } = data;
    const room = rooms.get(pin);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    // Host doesn't join as a player - they just connect to manage the room
    userSockets.set(userId, socket.id);
    socket.join(pin);

    // Send current room state to host
    const players = Array.from(room.players.values()).map(p => ({
      id: p.id,
      displayName: p.displayName
    }));

    socket.emit('room:joined', { roomId: room.id, pin });
    socket.emit('room:update', { players, state: room.state });

    // If the host is reconnecting mid-game, restore full state (no per-user question)
    if (room.state !== 'lobby') {
      socket.emit('room:sync', buildSyncPayload(room));
    }
  });

  socket.on('game:start', (data) => {
    const { pin, showQuestionDuringDiscussion, revealImpostorRole } = data;
    const room = rooms.get(pin);

    if (!room || room.state !== 'lobby') {
      socket.emit('error', { message: 'Cannot start game' });
      return;
    }

    const players = Array.from(room.players.keys());
    if (players.length < 3) {
      socket.emit('error', { message: 'Need at least 3 players to start' });
      return;
    }

    if (typeof showQuestionDuringDiscussion === 'boolean') {
      room.settings.showQuestionDuringDiscussion = showQuestionDuringDiscussion;
    }
    if (typeof revealImpostorRole === 'boolean') {
      room.settings.revealImpostorRole = revealImpostorRole;
    }

    // Start first round
    startRound(room);
  });

  socket.on('answer:submit', (data) => {
    const { pin, targetUserId } = data;
    const room = rooms.get(pin);
    
    if (!room || room.state !== 'answering') {
      socket.emit('error', { message: 'Not in answering phase' });
      return;
    }
    
    const userId = getUserIdFromSocket(socket.id);
    if (!userId || !room.currentRoundData) return;
    
    room.currentRoundData.answers.set(userId, targetUserId);
    
    // Send answer update to all players (for host to see)
    const answerData = Array.from(room.currentRoundData.answers.entries()).map(([playerId, answerId]) => ({
      playerId,
      playerName: room.players.get(playerId)?.displayName,
      answerId,
      answerName: room.players.get(answerId)?.displayName
    }));
    
    io.to(pin).emit('answers:update', { answers: answerData });
    
    // Check if all answers received
    if (room.currentRoundData.answers.size === room.players.size) {
      startDiscussion(room);
    }
  });

  socket.on('vote:submit', (data) => {
    const { pin, targetUserId } = data;
    const room = rooms.get(pin);
    
    if (!room || room.state !== 'voting') {
      socket.emit('error', { message: 'Not in voting phase' });
      return;
    }
    
    const userId = getUserIdFromSocket(socket.id);
    if (!userId || !room.currentRoundData) return;
    
    room.currentRoundData.votes.set(userId, targetUserId);
    
    // Check if all votes received
    if (room.currentRoundData.votes.size === room.players.size) {
      calculateResults(room);
    }
  });

  socket.on('discussion:skip-to-voting', (data) => {
    const { pin } = data;
    const room = rooms.get(pin);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const requesterUserId = getUserIdFromSocket(socket.id);
    if (requesterUserId !== room.hostUserId) {
      socket.emit('error', { message: 'Only the host can skip to voting' });
      return;
    }

    if (room.state !== 'discussing') {
      socket.emit('error', { message: 'Not in discussion phase' });
      return;
    }

    if (room.discussionTimeout) {
      clearTimeout(room.discussionTimeout);
      room.discussionTimeout = undefined;
    }

    startVoting(room);
  });

  socket.on('player:kick', (data) => {
    const { pin, targetUserId } = data;
    const room = rooms.get(pin);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const requesterUserId = getUserIdFromSocket(socket.id);
    if (requesterUserId !== room.hostUserId) {
      socket.emit('error', { message: 'Only the host can kick players' });
      return;
    }

    const targetPlayer = room.players.get(targetUserId);
    if (!targetPlayer) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }

    const pendingTimeout = disconnectTimeouts.get(targetUserId);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      disconnectTimeouts.delete(targetUserId);
    }

    room.players.delete(targetUserId);
    room.scores.delete(targetUserId);
    if (room.currentRoundData) {
      room.currentRoundData.answers.delete(targetUserId);
      room.currentRoundData.votes.delete(targetUserId);
    }

    const targetSocket = io.sockets.sockets.get(targetPlayer.socketId);
    if (targetSocket) {
      targetSocket.emit('player:kicked', { message: 'You have been kicked from the game by the host' });
      targetSocket.leave(room.pin);
    }
    userSockets.delete(targetUserId);

    const players = Array.from(room.players.values()).map(p => ({
      id: p.id,
      displayName: p.displayName
    }));
    io.to(room.pin).emit('room:update', { players, state: room.state });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const userId = getUserIdFromSocket(socket.id);
    if (!userId) return;

    // Don't remove immediately - give them a grace period to reconnect
    // (e.g. phone screen locks and the socket drops, but the player is still "in" the game)
    const timeout = setTimeout(() => {
      disconnectTimeouts.delete(userId);
      // Only remove if they never reconnected (socket mapping still points at the dead socket)
      if (userSockets.get(userId) !== socket.id) return;

      userSockets.delete(userId);
      for (const room of rooms.values()) {
        if (room.players.has(userId)) {
          room.players.delete(userId);
          room.scores.delete(userId);
          const players = Array.from(room.players.values()).map(p => ({
            id: p.id,
            displayName: p.displayName
          }));
          io.to(room.pin).emit('room:update', { players, state: room.state });
        }
      }
    }, RECONNECT_GRACE_MS);

    disconnectTimeouts.set(userId, timeout);
  });
});

function getUserIdFromSocket(socketId: string): string | undefined {
  for (const [userId, sId] of userSockets.entries()) {
    if (sId === socketId) return userId;
  }
  return undefined;
}

function getTimeLeft(room: Room): number {
  if (!room.phaseEndsAt) return 0;
  return Math.max(0, Math.round((room.phaseEndsAt - Date.now()) / 1000));
}

// Builds the state a (re)connecting client needs to resume mid-game, optionally
// personalized for a specific player (their question, whether they've already answered/voted)
function buildSyncPayload(room: Room, userId?: string) {
  const players = Array.from(room.players.values()).map(p => ({
    id: p.id,
    displayName: p.displayName
  }));
  const scores = Array.from(room.scores.entries()).map(([id, score]) => ({
    userId: id,
    displayName: room.players.get(id)?.displayName || 'Unknown',
    score
  }));

  const payload: any = {
    state: room.state,
    round: room.currentRound,
    timeLeft: getTimeLeft(room),
    players,
    scores
  };

  if (room.currentRoundData) {
    // Discussion question is the same for everyone (never the impostor's secret variant), so it
    // doesn't need a userId - safe to include for the host too.
    if (room.state === 'discussing' && room.settings.showQuestionDuringDiscussion) {
      payload.question = room.currentRoundData.groupQuestion;
    }

    if (userId) {
      const isImpostor = userId === room.currentRoundData.impostorId;
      if (room.state !== 'discussing') {
        payload.question = isImpostor ? room.currentRoundData.impostorQuestion : room.currentRoundData.groupQuestion;
      }
      payload.isImpostor = isImpostor && room.settings.revealImpostorRole;
      payload.hasAnswered = room.currentRoundData.answers.has(userId);
      payload.hasVoted = room.currentRoundData.votes.has(userId);
      payload.submittedAnswerId = room.currentRoundData.answers.get(userId);
      payload.submittedVoteId = room.currentRoundData.votes.get(userId);
    }
  }

  if (room.state === 'results' && room.lastRoundResult) {
    payload.lastResult = {
      impostorId: room.lastRoundResult.impostorId,
      impostorCaught: room.lastRoundResult.impostorCaught
    };
  }

  return payload;
}

function reconnectPlayer(room: Room, userId: string, socket: Socket) {
  const existingTimeout = disconnectTimeouts.get(userId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
    disconnectTimeouts.delete(userId);
  }

  const user = room.players.get(userId)!;
  user.socketId = socket.id;
  userSockets.set(userId, socket.id);
  socket.join(room.pin);

  const players = Array.from(room.players.values()).map(p => ({
    id: p.id,
    displayName: p.displayName
  }));

  socket.emit('room:joined', { roomId: room.id, pin: room.pin });
  socket.emit('room:update', { players, state: room.state });
  socket.emit('room:sync', buildSyncPayload(room, userId));
}

function startRound(room: Room) {
  room.currentRound++;
  room.state = 'answering';
  
  const players = Array.from(room.players.keys());
  const impostorId = players[Math.floor(Math.random() * players.length)];
  const { group, impostor } = getRandomQuestionPair();
  
  room.currentRoundData = {
    impostorId,
    groupQuestion: group.text,
    impostorQuestion: impostor.text,
    answers: new Map(),
    votes: new Map()
  };
  
  room.phaseEndsAt = Date.now() + room.settings.answerTimer * 1000;

  // Send round start to all players
  io.to(room.pin).emit('round:start', {
    roundNumber: room.currentRound,
    timer: room.settings.answerTimer
  });
  
  // Send questions to players
  players.forEach(playerId => {
    const user = room.players.get(playerId);
    if (!user) return;
    
    const isImpostor = playerId === impostorId;
    const question = isImpostor ? impostor.text : group.text;

    io.to(user.socketId).emit(isImpostor ? 'prompt:impostor' : 'prompt:group', {
      text: question,
      revealed: room.settings.revealImpostorRole,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        displayName: p.displayName
      }))
    });
  });
  
  // Start timer for answering phase
  setTimeout(() => {
    if (room.state === 'answering') {
      startDiscussion(room);
    }
  }, room.settings.answerTimer * 1000);
}

function startDiscussion(room: Room) {
  room.state = 'discussing';
  room.phaseEndsAt = Date.now() + room.settings.discussionTimer * 1000;

  io.to(room.pin).emit('discussion:start', {
    timer: room.settings.discussionTimer,
    question: room.settings.showQuestionDuringDiscussion ? room.currentRoundData?.groupQuestion : undefined
  });

  // Start timer for discussion phase (stored so the host can skip it early)
  room.discussionTimeout = setTimeout(() => {
    if (room.state === 'discussing') {
      startVoting(room);
    }
  }, room.settings.discussionTimer * 1000);
}

function startVoting(room: Room) {
  room.state = 'voting';
  room.phaseEndsAt = Date.now() + room.settings.voteTimer * 1000;

  const players = Array.from(room.players.values()).map(p => ({
    id: p.id,
    displayName: p.displayName
  }));

  io.to(room.pin).emit('voting:start', {
    timer: room.settings.voteTimer,
    players
  });
  
  // Start timer for voting phase
  setTimeout(() => {
    if (room.state === 'voting') {
      calculateResults(room);
    }
  }, room.settings.voteTimer * 1000);
}

function calculateResults(room: Room) {
  if (!room.currentRoundData) return;
  
  room.state = 'results';
  const { impostorId, votes } = room.currentRoundData;
  
  // Count votes
  const voteCounts = new Map<string, number>();
  for (const votedFor of votes.values()) {
    voteCounts.set(votedFor, (voteCounts.get(votedFor) || 0) + 1);
  }
  
  // Find player with most votes
  let maxVotes = 0;
  let mostVotedPlayer = '';
  for (const [playerId, count] of voteCounts.entries()) {
    if (count > maxVotes) {
      maxVotes = count;
      mostVotedPlayer = playerId;
    }
  }
  
  // Calculate scores
  const impostorCaught = mostVotedPlayer === impostorId && maxVotes > room.players.size / 2;
  
  if (impostorCaught) {
    // Everyone except impostor gets +1 point
    for (const playerId of room.players.keys()) {
      if (playerId !== impostorId) {
        room.scores.set(playerId, (room.scores.get(playerId) || 0) + 1);
      }
    }
  } else {
    // Impostor gets +3 points
    room.scores.set(impostorId, (room.scores.get(impostorId) || 0) + 3);
  }
  
  // Send results
  const scores = Array.from(room.scores.entries()).map(([userId, score]) => ({
    userId,
    displayName: room.players.get(userId)?.displayName || 'Unknown',
    score
  }));

  room.lastRoundResult = {
    impostorId,
    impostorCaught,
    votes: Array.from(votes.entries()),
    scores
  };
  room.phaseEndsAt = Date.now() + 5000;

  io.to(room.pin).emit('round:result', {
    impostorId,
    impostorCaught,
    votes: Array.from(votes.entries()),
    scores
  });

  // Check if game should end
  setTimeout(() => {
    if (room.currentRound >= room.settings.rounds) {
      endGame(room);
    } else {
      startRound(room);
    }
  }, 5000); // Show results for 5 seconds
}

function endGame(room: Room) {
  room.state = 'ended';
  
  const finalScores = Array.from(room.scores.entries())
    .map(([userId, score]) => ({
      userId,
      displayName: room.players.get(userId)?.displayName || 'Unknown',
      score
    }))
    .sort((a, b) => b.score - a.score);
  
  io.to(room.pin).emit('game:end', { finalScores });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});