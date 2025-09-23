// backend/src/server.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
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
  scores: Map<string, number>;
  timerInterval?: NodeJS.Timeout;
}

interface Question {
  id: string;
  text: string;
  type: 'group' | 'impostor';
  tags?: string[];
}

// Comprehensive question bank with paired opposites
const SAMPLE_QUESTIONS: Question[] = [
  // Personality & Humor
  { id: '1', text: 'Who is the funniest?', type: 'group', tags: ['personality', 'humor'] },
  { id: '2', text: 'Who is the most serious?', type: 'impostor', tags: ['personality', 'humor'] },
  { id: '3', text: 'Who tells the best jokes?', type: 'group', tags: ['personality', 'humor'] },
  { id: '4', text: 'Who tells the worst jokes?', type: 'impostor', tags: ['personality', 'humor'] },
  { id: '5', text: 'Who laughs the loudest?', type: 'group', tags: ['personality', 'humor'] },
  { id: '6', text: 'Who laughs the quietest?', type: 'impostor', tags: ['personality', 'humor'] },
  { id: '7', text: 'Who has the most contagious laugh?', type: 'group', tags: ['personality', 'humor'] },
  { id: '8', text: 'Who has the most awkward laugh?', type: 'impostor', tags: ['personality', 'humor'] },
  { id: '9', text: 'Who makes awkward situations funny?', type: 'group', tags: ['personality', 'humor'] },
  { id: '10', text: 'Who makes funny situations awkward?', type: 'impostor', tags: ['personality', 'humor'] },

  // School / Work
  { id: '11', text: 'Who is the most hardworking?', type: 'group', tags: ['school', 'work'] },
  { id: '12', text: 'Who is the laziest?', type: 'impostor', tags: ['school', 'work'] },
  { id: '13', text: 'Who procrastinates the most?', type: 'group', tags: ['school', 'work'] },
  { id: '14', text: 'Who always finishes things early?', type: 'impostor', tags: ['school', 'work'] },
  { id: '15', text: 'Who is most likely to forget homework?', type: 'group', tags: ['school', 'work'] },
  { id: '16', text: 'Who never forgets anything?', type: 'impostor', tags: ['school', 'work'] },
  { id: '17', text: 'Who gives the best presentations?', type: 'group', tags: ['school', 'work'] },
  { id: '18', text: 'Who is most afraid of public speaking?', type: 'impostor', tags: ['school', 'work'] },
  { id: '19', text: 'Who would be the best teacher?', type: 'group', tags: ['school', 'work'] },
  { id: '20', text: 'Who would be the worst teacher?', type: 'impostor', tags: ['school', 'work'] },

  // Everyday Life
  { id: '21', text: 'Who is the most organized?', type: 'group', tags: ['lifestyle'] },
  { id: '22', text: 'Who is the messiest?', type: 'impostor', tags: ['lifestyle'] },
  { id: '23', text: 'Who is the best cook?', type: 'group', tags: ['lifestyle'] },
  { id: '24', text: 'Who burns water when cooking?', type: 'impostor', tags: ['lifestyle'] },
  { id: '25', text: 'Who is most likely to oversleep?', type: 'group', tags: ['lifestyle'] },
  { id: '26', text: 'Who is always the first one awake?', type: 'impostor', tags: ['lifestyle'] },
  { id: '27', text: 'Who spends the most time on their phone?', type: 'group', tags: ['lifestyle'] },
  { id: '28', text: 'Who uses their phone the least?', type: 'impostor', tags: ['lifestyle'] },

  // Social Life
  { id: '29', text: 'Who is the most talkative?', type: 'group', tags: ['social'] },
  { id: '30', text: 'Who is the quietest?', type: 'impostor', tags: ['social'] },
  { id: '31', text: 'Who gives the best advice?', type: 'group', tags: ['social'] },
  { id: '32', text: 'Who gives the worst advice?', type: 'impostor', tags: ['social'] },
  { id: '33', text: 'Who is the best listener?', type: 'group', tags: ['social'] },
  { id: '34', text: 'Who interrupts people the most?', type: 'impostor', tags: ['social'] },
  { id: '35', text: 'Who is the life of the party?', type: 'group', tags: ['social'] },
  { id: '36', text: 'Who leaves parties first?', type: 'impostor', tags: ['social'] },

  // Adventure & Risk
  { id: '37', text: 'Who would survive a zombie apocalypse?', type: 'group', tags: ['adventure'] },
  { id: '38', text: 'Who would be first eliminated in a zombie apocalypse?', type: 'impostor', tags: ['adventure'] },
  { id: '39', text: 'Who would get lost on a trip?', type: 'group', tags: ['adventure'] },
  { id: '40', text: 'Who has the best sense of direction?', type: 'impostor', tags: ['adventure'] },
  { id: '41', text: 'Who would try the weirdest food?', type: 'group', tags: ['adventure'] },
  { id: '42', text: 'Who is the pickiest eater?', type: 'impostor', tags: ['adventure'] },
  { id: '43', text: 'Who is most likely to go skydiving?', type: 'group', tags: ['adventure'] },
  { id: '44', text: 'Who is most afraid of heights?', type: 'impostor', tags: ['adventure'] },
  { id: '45', text: 'Who is the most spontaneous?', type: 'group', tags: ['adventure'] },
  { id: '46', text: 'Who plans everything in advance?', type: 'impostor', tags: ['adventure'] },

  // Entertainment
  { id: '47', text: 'Who knows the most about movies?', type: 'group', tags: ['entertainment'] },
  { id: '48', text: 'Who has seen the fewest movies?', type: 'impostor', tags: ['entertainment'] },
  { id: '49', text: 'Who is most likely to binge-watch a show in one day?', type: 'group', tags: ['entertainment'] },
  { id: '50', text: 'Who watches the least TV?', type: 'impostor', tags: ['entertainment'] },
  { id: '51', text: 'Who is the biggest gamer?', type: 'group', tags: ['entertainment'] },
  { id: '52', text: 'Who has never touched a video game?', type: 'impostor', tags: ['entertainment'] },
  { id: '53', text: 'Who sings the loudest in the car?', type: 'group', tags: ['entertainment'] },
  { id: '54', text: 'Who refuses to sing along?', type: 'impostor', tags: ['entertainment'] },
  { id: '55', text: 'Who always picks the best music?', type: 'group', tags: ['entertainment'] },
  { id: '56', text: 'Who has the worst taste in music?', type: 'impostor', tags: ['entertainment'] },

  // Embarrassing / Silly
  { id: '57', text: 'Who trips the most?', type: 'group', tags: ['silly'] },
  { id: '58', text: 'Who has the best balance?', type: 'impostor', tags: ['silly'] },
  { id: '59', text: 'Who forgets names the most?', type: 'group', tags: ['silly'] },
  { id: '60', text: 'Who remembers everyone\'s name?', type: 'impostor', tags: ['silly'] },
  { id: '61', text: 'Who laughs at their own jokes the most?', type: 'group', tags: ['silly'] },
  { id: '62', text: 'Who never finds their own jokes funny?', type: 'impostor', tags: ['silly'] },
  { id: '63', text: 'Who takes the longest selfies?', type: 'group', tags: ['silly'] },
  { id: '64', text: 'Who hates taking photos?', type: 'impostor', tags: ['silly'] },
  { id: '65', text: 'Who is most likely to say something embarrassing in public?', type: 'group', tags: ['silly'] },
  { id: '66', text: 'Who thinks before they speak?', type: 'impostor', tags: ['silly'] },

  // Relationships & Personality
  { id: '67', text: 'Who is the most romantic?', type: 'group', tags: ['personality'] },
  { id: '68', text: 'Who is the least romantic?', type: 'impostor', tags: ['personality'] },
  { id: '69', text: 'Who gives the best compliments?', type: 'group', tags: ['personality'] },
  { id: '70', text: 'Who never compliments anyone?', type: 'impostor', tags: ['personality'] },
  { id: '71', text: 'Who is the most competitive?', type: 'group', tags: ['personality'] },
  { id: '72', text: 'Who doesn\'t care about winning?', type: 'impostor', tags: ['personality'] },
  { id: '73', text: 'Who is the most dramatic?', type: 'group', tags: ['personality'] },
  { id: '74', text: 'Who is the most chill?', type: 'impostor', tags: ['personality'] },

  // Misc / Random
  { id: '75', text: 'Who would be the best president/leader?', type: 'group', tags: ['random'] },
  { id: '76', text: 'Who would be the worst leader?', type: 'impostor', tags: ['random'] },
  { id: '77', text: 'Who is most likely to move abroad?', type: 'group', tags: ['random'] },
  { id: '78', text: 'Who will never leave their hometown?', type: 'impostor', tags: ['random'] },
  { id: '79', text: 'Who is most likely to become famous?', type: 'group', tags: ['random'] },
  { id: '80', text: 'Who prefers to stay anonymous?', type: 'impostor', tags: ['random'] },
  { id: '81', text: 'Who is the most creative?', type: 'group', tags: ['random'] },
  { id: '82', text: 'Who thinks inside the box?', type: 'impostor', tags: ['random'] },
  { id: '83', text: 'Who is the best problem-solver?', type: 'group', tags: ['random'] },
  { id: '84', text: 'Who creates more problems than they solve?', type: 'impostor', tags: ['random'] },
  { id: '85', text: 'Who would win a trivia contest?', type: 'group', tags: ['random'] },
  { id: '86', text: 'Who knows the least random facts?', type: 'impostor', tags: ['random'] },
  { id: '87', text: 'Who is the best dancer?', type: 'group', tags: ['random'] },
  { id: '88', text: 'Who has two left feet?', type: 'impostor', tags: ['random'] },
  { id: '89', text: 'Who would be a stand-up comedian?', type: 'group', tags: ['random'] },
  { id: '90', text: 'Who would bomb on stage?', type: 'impostor', tags: ['random'] },
  { id: '91', text: 'Who is the best at keeping secrets?', type: 'group', tags: ['random'] },
  { id: '92', text: 'Who can\'t keep a secret to save their life?', type: 'impostor', tags: ['random'] },
  { id: '93', text: 'Who would survive without the internet the longest?', type: 'group', tags: ['random'] },
  { id: '94', text: 'Who would die without WiFi?', type: 'impostor', tags: ['random'] },
];

// In-memory storage (replace with Redis in production)
const rooms = new Map<string, Room>();
const userSockets = new Map<string, string>(); // userId -> socketId

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Frontend URL
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Generate unique 6-digit PIN
function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Get random question pair (group + impostor) with diversity to avoid obvious opposites
function getDiverseQuestionPair(): { group: Question; impostor: Question } {
  const groupQuestions = SAMPLE_QUESTIONS.filter(q => q.type === 'group');
  const impostorQuestions = SAMPLE_QUESTIONS.filter(q => q.type === 'impostor');

  const groupQuestion = groupQuestions[Math.floor(Math.random() * groupQuestions.length)];

  // Prefer impostor questions that are NOT the sequential opposite and have different tags
  const preferredPool = impostorQuestions.filter(q => {
    const notOpposite = Math.abs(Number(q.id) - Number(groupQuestion.id)) !== 1;
    const differentTag = groupQuestion.tags && q.tags
      ? !groupQuestion.tags.some(t => (q.tags || []).includes(t))
      : true;
    return notOpposite && differentTag;
  });

  const fallbackPool = impostorQuestions.filter(q => Math.abs(Number(q.id) - Number(groupQuestion.id)) !== 1);
  const usablePool = preferredPool.length > 0 ? preferredPool : (fallbackPool.length > 0 ? fallbackPool : impostorQuestions);

  const impostorQuestion = usablePool[Math.floor(Math.random() * usablePool.length)];

  return { group: groupQuestion, impostor: impostorQuestion };
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
      voteTimer: 15
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
    
    if (room.state !== 'lobby') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    // Enforce unique player names (case-insensitive, trimmed)
    const normalizedName = (displayName || '').trim();
    if (!normalizedName) {
      socket.emit('error', { message: 'Display name is required' });
      return;
    }
    const nameTaken = Array.from(room.players.values()).some(
      (p) => p.displayName.trim().toLowerCase() === normalizedName.toLowerCase()
    );
    if (nameTaken) {
      socket.emit('error', { message: 'That player name is already in use. Pick another name.' });
      return;
    }
    
    const user: User = { id: userId, displayName: normalizedName, socketId: socket.id };
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
  });

  // Allow clients to re-identify after reconnect to refresh their socket mapping
  socket.on('user:identify', (data: { userId: string; pin?: string }) => {
    const { userId, pin } = data || {} as any;
    if (!userId) return;
    userSockets.set(userId, socket.id);
    // Update socketId inside any room that contains this user
    for (const room of rooms.values()) {
      if (room.players.has(userId)) {
        const user = room.players.get(userId)!;
        user.socketId = socket.id;
        if (pin && pin === room.pin) {
          socket.join(room.pin);
          // Send a lightweight state ping so client can refresh if needed
          const players = Array.from(room.players.values()).map(p => ({ id: p.id, displayName: p.displayName }));
          socket.emit('room:update', { players, state: room.state });
          // If a round is active, resend their current prompt
          if (room.state === 'answering' && room.currentRoundData) {
            const isImpostor = user.id === room.currentRoundData.impostorId;
            const question = isImpostor ? room.currentRoundData.impostorQuestion : room.currentRoundData.groupQuestion;
            socket.emit(isImpostor ? 'prompt:impostor' : 'prompt:group', {
              text: question,
              players
            });
          }
        }
      }
    }
  });

  socket.on('game:start', (data) => {
    const { pin, settings } = data;
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
    
    // Update room settings if provided
    if (settings) {
      console.log('Updating room settings:', settings);
      room.settings = {
        ...room.settings,
        ...settings
      };
    }
    
    // Start first round
    startRound(room);
  });

  socket.on('answer:submit', (data) => {
    console.log('Answer submitted:', data);
    const { pin, targetUserId } = data;
    const room = rooms.get(pin);
    
    if (!room || room.state !== 'answering') {
      console.log('Answer rejected - not in answering phase:', room?.state);
      socket.emit('error', { message: 'Not in answering phase' });
      return;
    }
    
    const userId = getUserIdFromSocket(socket.id);
    console.log('User ID from socket:', userId, 'Socket ID:', socket.id);
    if (!userId || !room.currentRoundData) {
      console.log('Missing userId or roundData:', { userId, roundData: !!room.currentRoundData });
      return;
    }
    
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
    console.log('Answer count:', room.currentRoundData.answers.size, 'Player count:', room.players.size);
    if (room.currentRoundData.answers.size === room.players.size) {
      console.log('All answers received, starting discussion');
      startDiscussion(room);
    }
  });

  socket.on('vote:submit', (data) => {
    console.log('Vote submitted:', data);
    const { pin, targetUserId } = data;
    const room = rooms.get(pin);
    
    if (!room || room.state !== 'voting') {
      console.log('Vote rejected - not in voting phase:', room?.state);
      socket.emit('error', { message: 'Not in voting phase' });
      return;
    }
    
    const userId = getUserIdFromSocket(socket.id);
    console.log('User ID from socket (vote):', userId, 'Socket ID:', socket.id);
    if (!userId || !room.currentRoundData) {
      console.log('Missing userId or roundData (vote):', { userId, roundData: !!room.currentRoundData });
      return;
    }
    
    room.currentRoundData.votes.set(userId, targetUserId);
    
    // Check if all votes received
    console.log('Vote count:', room.currentRoundData.votes.size, 'Player count:', room.players.size);
    if (room.currentRoundData.votes.size === room.players.size) {
      console.log('All votes received, calculating results');
      calculateResults(room);
    }
  });

  // Theme broadcast handler
  socket.on('theme:broadcast', (data) => {
    const { pin, theme } = data;
    const room = rooms.get(pin);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    console.log('Broadcasting theme:', theme, 'to room:', pin);
    
    // Broadcast theme to all players in the room
    io.to(pin).emit('theme:update', { theme });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Handle player disconnect - remove from rooms
    for (const [socketId, userId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(socketId);
        // Remove from all rooms
        for (const room of rooms.values()) {
          if (room.players.has(userId)) {
            room.players.delete(userId);
            room.scores.delete(userId);
            // Broadcast updated player list
            const players = Array.from(room.players.values()).map(p => ({
              id: p.id,
              displayName: p.displayName
            }));
            io.to(room.pin).emit('room:update', { players, state: room.state });
          }
        }
        break;
      }
    }
  });
});

function getUserIdFromSocket(socketId: string): string | undefined {
  console.log('Looking for socket ID:', socketId, 'in userSockets:', Array.from(userSockets.entries()));
  for (const [userId, sId] of userSockets.entries()) {
    if (sId === socketId) {
      console.log('Found user ID:', userId);
      return userId;
    }
  }
  console.log('No user ID found for socket:', socketId);
  return undefined;
}

function startRound(room: Room) {
  room.currentRound++;
  room.state = 'answering';
  console.log(`Starting round ${room.currentRound} for room ${room.pin}`);
  
  const players = Array.from(room.players.keys());
  const impostorId = players[Math.floor(Math.random() * players.length)];
  const { group, impostor } = getDiverseQuestionPair();
  
  room.currentRoundData = {
    impostorId,
    groupQuestion: group.text,
    impostorQuestion: impostor.text,
    answers: new Map(),
    votes: new Map()
  };
  
  // Send round start to all players
  io.to(room.pin).emit('round:start', {
    roundNumber: room.currentRound,
    timer: room.settings.answerTimer
  });
  
  // Start server-side timer sync
  startTimerSync(room, room.settings.answerTimer);
  
  // Send questions to players
  players.forEach(playerId => {
    const user = room.players.get(playerId);
    if (!user) return;
    
    const isImpostor = playerId === impostorId;
    const question = isImpostor ? impostor.text : group.text;
    
    io.to(user.socketId).emit(isImpostor ? 'prompt:impostor' : 'prompt:group', {
      text: question,
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
  
  io.to(room.pin).emit('discussion:start', {
    timer: room.settings.discussionTimer
  });
  
  // Start server-side timer sync
  startTimerSync(room, room.settings.discussionTimer);
  
  // Start timer for discussion phase
  setTimeout(() => {
    if (room.state === 'discussing') {
      startVoting(room);
    }
  }, room.settings.discussionTimer * 1000);
}

function startVoting(room: Room) {
  room.state = 'voting';
  
  const players = Array.from(room.players.values()).map(p => ({
    id: p.id,
    displayName: p.displayName
  }));
  
  io.to(room.pin).emit('voting:start', {
    timer: room.settings.voteTimer,
    players
  });
  
  // Start server-side timer sync
  startTimerSync(room, room.settings.voteTimer);
  
  // Start timer for voting phase
  setTimeout(() => {
    if (room.state === 'voting') {
      calculateResults(room);
    }
  }, room.settings.voteTimer * 1000);
}

function calculateResults(room: Room) {
  if (!room.currentRoundData) return;
  
  console.log(`Calculating results for round ${room.currentRound} in room ${room.pin}`);
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

// Timer synchronization function
function startTimerSync(room: Room, duration: number) {
  // Clear any existing phase timer to prevent overlapping updates
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = undefined;
  }

  let timeLeft = duration;
  
  const timerInterval = setInterval(() => {
    timeLeft--;
    
    // Send timer update to all clients
    io.to(room.pin).emit('timer:update', { timeLeft });
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
    }
  }, 1000);
  
  // Store the interval ID so we can clear it if needed
  room.timerInterval = timerInterval;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});