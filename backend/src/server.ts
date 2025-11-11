// backend/src/server.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { randomInt } from 'crypto';

// Types
interface User {
  id: string;
  displayName: string;
  socketId: string;
  status: 'connected' | 'disconnected';
  disconnectedAt?: Date;
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
    fakeId: string;
    groupQuestion: string;
    fakeQuestion: string;
    answers: Map<string, string>;
    votes: Map<string, string>;
  };
  scores: Map<string, number>;
  usedQuestionIds: Set<string>; // Track which question IDs have been used
  timerInterval?: NodeJS.Timeout;
  discussionTimeout?: NodeJS.Timeout;
  answerTimeout?: NodeJS.Timeout;
  voteTimeout?: NodeJS.Timeout;
  resultsTimeout?: NodeJS.Timeout;
  disconnectTimeouts?: Map<string, NodeJS.Timeout>; // Track disconnect timeouts
}

// Configuration constants
const DISCONNECT_GRACE_PERIOD = 60 * 1000; // 60 seconds in milliseconds
const MAX_PLAYERS = 10; // Hard cap on concurrent connected players per room

interface Question {
  id: string;
  text: string;
  type: 'group' | 'fake';
  tags?: string[];
}

// Comprehensive question bank with paired opposites
const SAMPLE_QUESTIONS: Question[] = [
  // Personality & Humor
  { id: '1', text: 'Who is the funniest?', type: 'group', tags: ['personality', 'humor'] },
  { id: '2', text: 'Who is the most serious?', type: 'fake', tags: ['personality', 'humor'] },
  { id: '3', text: 'Who tells the best jokes?', type: 'group', tags: ['personality', 'humor'] },
  { id: '4', text: 'Who tells the worst jokes?', type: 'fake', tags: ['personality', 'humor'] },
  { id: '5', text: 'Who laughs the loudest?', type: 'group', tags: ['personality', 'humor'] },
  { id: '6', text: 'Who laughs the quietest?', type: 'fake', tags: ['personality', 'humor'] },
  { id: '7', text: 'Who has the most contagious laugh?', type: 'group', tags: ['personality', 'humor'] },
  { id: '8', text: 'Who has the most awkward laugh?', type: 'fake', tags: ['personality', 'humor'] },
  { id: '9', text: 'Who makes awkward situations funny?', type: 'group', tags: ['personality', 'humor'] },
  { id: '10', text: 'Who makes funny situations awkward?', type: 'fake', tags: ['personality', 'humor'] },

  // School / Work
  { id: '11', text: 'Who is the most hardworking?', type: 'group', tags: ['school', 'work'] },
  { id: '12', text: 'Who is the laziest?', type: 'fake', tags: ['school', 'work'] },
  { id: '13', text: 'Who procrastinates the most?', type: 'group', tags: ['school', 'work'] },
  { id: '14', text: 'Who always finishes things early?', type: 'fake', tags: ['school', 'work'] },
  { id: '15', text: 'Who is most likely to forget homework?', type: 'group', tags: ['school', 'work'] },
  { id: '16', text: 'Who never forgets anything?', type: 'fake', tags: ['school', 'work'] },
  { id: '17', text: 'Who gives the best presentations?', type: 'group', tags: ['school', 'work'] },
  { id: '18', text: 'Who is most afraid of public speaking?', type: 'fake', tags: ['school', 'work'] },
  { id: '19', text: 'Who would be the best teacher?', type: 'group', tags: ['school', 'work'] },
  { id: '20', text: 'Who would be the worst teacher?', type: 'fake', tags: ['school', 'work'] },

  // Everyday Life
  { id: '21', text: 'Who is the most organized?', type: 'group', tags: ['lifestyle'] },
  { id: '22', text: 'Who is the messiest?', type: 'fake', tags: ['lifestyle'] },
  { id: '23', text: 'Who is the best cook?', type: 'group', tags: ['lifestyle'] },
  { id: '24', text: 'Who burns water when cooking?', type: 'fake', tags: ['lifestyle'] },
  { id: '25', text: 'Who is most likely to oversleep?', type: 'group', tags: ['lifestyle'] },
  { id: '26', text: 'Who is always the first one awake?', type: 'fake', tags: ['lifestyle'] },
  { id: '27', text: 'Who spends the most time on their phone?', type: 'group', tags: ['lifestyle'] },
  { id: '28', text: 'Who uses their phone the least?', type: 'fake', tags: ['lifestyle'] },

  // Social Life
  { id: '29', text: 'Who is the most talkative?', type: 'group', tags: ['social'] },
  { id: '30', text: 'Who is the quietest?', type: 'fake', tags: ['social'] },
  { id: '31', text: 'Who gives the best advice?', type: 'group', tags: ['social'] },
  { id: '32', text: 'Who gives the worst advice?', type: 'fake', tags: ['social'] },
  { id: '33', text: 'Who is the best listener?', type: 'group', tags: ['social'] },
  { id: '34', text: 'Who interrupts people the most?', type: 'fake', tags: ['social'] },
  { id: '35', text: 'Who is the life of the party?', type: 'group', tags: ['social'] },
  { id: '36', text: 'Who leaves parties first?', type: 'fake', tags: ['social'] },

  // Adventure & Risk
  { id: '37', text: 'Who would survive a zombie apocalypse?', type: 'group', tags: ['adventure'] },
  { id: '38', text: 'Who would be first eliminated in a zombie apocalypse?', type: 'fake', tags: ['adventure'] },
  { id: '39', text: 'Who would get lost on a trip?', type: 'group', tags: ['adventure'] },
  { id: '40', text: 'Who has the best sense of direction?', type: 'fake', tags: ['adventure'] },
  { id: '41', text: 'Who would try the weirdest food?', type: 'group', tags: ['adventure'] },
  { id: '42', text: 'Who is the pickiest eater?', type: 'fake', tags: ['adventure'] },
  { id: '43', text: 'Who is most likely to go skydiving?', type: 'group', tags: ['adventure'] },
  { id: '44', text: 'Who is most afraid of heights?', type: 'fake', tags: ['adventure'] },
  { id: '45', text: 'Who is the most spontaneous?', type: 'group', tags: ['adventure'] },
  { id: '46', text: 'Who plans everything in advance?', type: 'fake', tags: ['adventure'] },

  // Entertainment
  { id: '47', text: 'Who knows the most about movies?', type: 'group', tags: ['entertainment'] },
  { id: '48', text: 'Who has seen the fewest movies?', type: 'fake', tags: ['entertainment'] },
  { id: '49', text: 'Who is most likely to binge-watch a show in one day?', type: 'group', tags: ['entertainment'] },
  { id: '50', text: 'Who watches the least TV?', type: 'fake', tags: ['entertainment'] },
  { id: '51', text: 'Who is the biggest gamer?', type: 'group', tags: ['entertainment'] },
  { id: '52', text: 'Who has never touched a video game?', type: 'fake', tags: ['entertainment'] },
  { id: '53', text: 'Who sings the loudest in the car?', type: 'group', tags: ['entertainment'] },
  { id: '54', text: 'Who refuses to sing along?', type: 'fake', tags: ['entertainment'] },
  { id: '55', text: 'Who always picks the best music?', type: 'group', tags: ['entertainment'] },
  { id: '56', text: 'Who has the worst taste in music?', type: 'fake', tags: ['entertainment'] },

  // Embarrassing / Silly
  { id: '57', text: 'Who trips the most?', type: 'group', tags: ['silly'] },
  { id: '58', text: 'Who has the best balance?', type: 'fake', tags: ['silly'] },
  { id: '59', text: 'Who forgets names the most?', type: 'group', tags: ['silly'] },
  { id: '60', text: 'Who remembers everyone\'s name?', type: 'fake', tags: ['silly'] },
  { id: '61', text: 'Who laughs at their own jokes the most?', type: 'group', tags: ['silly'] },
  { id: '62', text: 'Who never finds their own jokes funny?', type: 'fake', tags: ['silly'] },
  { id: '63', text: 'Who takes the longest selfies?', type: 'group', tags: ['silly'] },
  { id: '64', text: 'Who hates taking photos?', type: 'fake', tags: ['silly'] },
  { id: '65', text: 'Who is most likely to say something embarrassing in public?', type: 'group', tags: ['silly'] },
  { id: '66', text: 'Who thinks before they speak?', type: 'fake', tags: ['silly'] },

  // Relationships & Personality
  { id: '67', text: 'Who is the most romantic?', type: 'group', tags: ['personality'] },
  { id: '68', text: 'Who is the least romantic?', type: 'fake', tags: ['personality'] },
  { id: '69', text: 'Who gives the best compliments?', type: 'group', tags: ['personality'] },
  { id: '70', text: 'Who never compliments anyone?', type: 'fake', tags: ['personality'] },
  { id: '71', text: 'Who is the most competitive?', type: 'group', tags: ['personality'] },
  { id: '72', text: 'Who doesn\'t care about winning?', type: 'fake', tags: ['personality'] },
  { id: '73', text: 'Who is the most dramatic?', type: 'group', tags: ['personality'] },
  { id: '74', text: 'Who is the most chill?', type: 'fake', tags: ['personality'] },

  // Misc / Random
  { id: '75', text: 'Who would be the best president/leader?', type: 'group', tags: ['random'] },
  { id: '76', text: 'Who would be the worst leader?', type: 'fake', tags: ['random'] },
  { id: '77', text: 'Who is most likely to move abroad?', type: 'group', tags: ['random'] },
  { id: '78', text: 'Who will never leave their hometown?', type: 'fake', tags: ['random'] },
  { id: '79', text: 'Who is most likely to become famous?', type: 'group', tags: ['random'] },
  { id: '80', text: 'Who prefers to stay anonymous?', type: 'fake', tags: ['random'] },
  { id: '81', text: 'Who is the most creative?', type: 'group', tags: ['random'] },
  { id: '82', text: 'Who thinks inside the box?', type: 'fake', tags: ['random'] },
  { id: '83', text: 'Who is the best problem-solver?', type: 'group', tags: ['random'] },
  { id: '84', text: 'Who creates more problems than they solve?', type: 'fake', tags: ['random'] },
  { id: '85', text: 'Who would win a trivia contest?', type: 'group', tags: ['random'] },
  { id: '86', text: 'Who knows the least random facts?', type: 'fake', tags: ['random'] },
  { id: '87', text: 'Who is the best dancer?', type: 'group', tags: ['random'] },
  { id: '88', text: 'Who has two left feet?', type: 'fake', tags: ['random'] },
  { id: '89', text: 'Who would be a stand-up comedian?', type: 'group', tags: ['random'] },
  { id: '90', text: 'Who would bomb on stage?', type: 'fake', tags: ['random'] },
  { id: '91', text: 'Who is the best at keeping secrets?', type: 'group', tags: ['random'] },
  { id: '92', text: 'Who can\'t keep a secret to save their life?', type: 'fake', tags: ['random'] },
  { id: '93', text: 'Who would survive without the internet the longest?', type: 'group', tags: ['random'] },
  { id: '94', text: 'Who would die without WiFi?', type: 'fake', tags: ['random'] },

  // 🧠 Personality & Humor
  { id: '95', text: 'Who can make anyone laugh in under 10 seconds?', type: 'group', tags: ['personality', 'humor'] },
  { id: '96', text: 'Who laughs at the wrong moments?', type: 'fake', tags: ['personality', 'humor'] },
  { id: '97', text: 'Who has the most contagious energy?', type: 'group', tags: ['personality', 'humor'] },
  { id: '98', text: 'Who drains everyone\'s energy first?', type: 'fake', tags: ['personality', 'humor'] },
  { id: '99', text: 'Who could star in a comedy show?', type: 'group', tags: ['personality', 'humor'] },
  { id: '100', text: 'Who would get booed off stage?', type: 'fake', tags: ['personality', 'humor'] },
  { id: '101', text: 'Who takes jokes too seriously?', type: 'fake', tags: ['personality', 'humor'] },
  { id: '102', text: 'Who tells dad jokes unironically?', type: 'group', tags: ['personality', 'humor'] },
  { id: '103', text: 'Who cracks up before finishing their story?', type: 'group', tags: ['personality', 'humor'] },
  { id: '104', text: 'Who has the most monotone delivery?', type: 'fake', tags: ['personality', 'humor'] },

  // 📚 School & Work
  { id: '105', text: 'Who actually enjoys doing group projects?', type: 'group', tags: ['school', 'work'] },
  { id: '106', text: 'Who ghosts their group during projects?', type: 'fake', tags: ['school', 'work'] },
  { id: '107', text: 'Who would survive an all-nighter the best?', type: 'group', tags: ['school', 'work'] },
  { id: '108', text: 'Who falls asleep first during study sessions?', type: 'fake', tags: ['school', 'work'] },
  { id: '109', text: 'Who would end up managing the whole project?', type: 'group', tags: ['school', 'work'] },
  { id: '110', text: 'Who would forget the deadline completely?', type: 'fake', tags: ['school', 'work'] },
  { id: '111', text: 'Who color-codes their notes?', type: 'group', tags: ['school', 'work'] },
  { id: '112', text: 'Who doesn\'t even own a notebook?', type: 'fake', tags: ['school', 'work'] },
  { id: '113', text: 'Who thrives under pressure?', type: 'group', tags: ['school', 'work'] },
  { id: '114', text: 'Who panics when the clock hits 11:59?', type: 'fake', tags: ['school', 'work'] },

  // 🏡 Lifestyle
  { id: '115', text: 'Who would have the cleanest apartment?', type: 'group', tags: ['lifestyle'] },
  { id: '116', text: 'Who would lose their keys in their own room?', type: 'fake', tags: ['lifestyle'] },
  { id: '117', text: 'Who starts every morning with coffee?', type: 'group', tags: ['lifestyle'] },
  { id: '118', text: 'Who drinks five energy drinks instead?', type: 'fake', tags: ['lifestyle'] },
  { id: '119', text: 'Who could live without social media for a month?', type: 'group', tags: ['lifestyle'] },
  { id: '120', text: 'Who refreshes Instagram every five minutes?', type: 'fake', tags: ['lifestyle'] },
  { id: '121', text: 'Who has the best sense of fashion?', type: 'group', tags: ['lifestyle'] },
  { id: '122', text: 'Who still wears socks with sandals?', type: 'fake', tags: ['lifestyle'] },
  { id: '123', text: 'Who actually follows their New Year\'s resolutions?', type: 'group', tags: ['lifestyle'] },
  { id: '124', text: 'Who forgets them by January 2nd?', type: 'fake', tags: ['lifestyle'] },

  // 💬 Social
  { id: '125', text: 'Who makes friends wherever they go?', type: 'group', tags: ['social'] },
  { id: '126', text: 'Who avoids eye contact at all costs?', type: 'fake', tags: ['social'] },
  { id: '127', text: 'Who remembers everyone\'s birthday?', type: 'group', tags: ['social'] },
  { id: '128', text: 'Who forgets their own?', type: 'fake', tags: ['social'] },
  { id: '129', text: 'Who throws the best parties?', type: 'group', tags: ['social'] },
  { id: '130', text: 'Who leaves before dessert?', type: 'fake', tags: ['social'] },
  { id: '131', text: 'Who would be the best team captain?', type: 'group', tags: ['social'] },
  { id: '132', text: 'Who would cause the team to forfeit?', type: 'fake', tags: ['social'] },
  { id: '133', text: 'Who gives the most pep talks?', type: 'group', tags: ['social'] },
  { id: '134', text: 'Who tells everyone to give up early?', type: 'fake', tags: ['social'] },

  // 🌍 Adventure & Risk
  { id: '135', text: 'Who would climb a mountain for fun?', type: 'group', tags: ['adventure'] },
  { id: '136', text: 'Who would complain about the WiFi on the mountain?', type: 'fake', tags: ['adventure'] },
  { id: '137', text: 'Who loves spontaneous trips?', type: 'group', tags: ['adventure'] },
  { id: '138', text: 'Who needs an itinerary for everything?', type: 'fake', tags: ['adventure'] },
  { id: '139', text: 'Who would volunteer to go first on a roller coaster?', type: 'group', tags: ['adventure'] },
  { id: '140', text: 'Who screams before the ride even starts?', type: 'fake', tags: ['adventure'] },
  { id: '141', text: 'Who is most likely to go camping?', type: 'group', tags: ['adventure'] },
  { id: '142', text: 'Who calls camping "sleeping in discomfort"?', type: 'fake', tags: ['adventure'] },
  { id: '143', text: 'Who could survive being stranded on an island?', type: 'group', tags: ['adventure'] },
  { id: '144', text: 'Who would accidentally burn the only food?', type: 'fake', tags: ['adventure'] },

  // 🎬 Entertainment
  { id: '145', text: 'Who knows every lyric to every song?', type: 'group', tags: ['entertainment'] },
  { id: '146', text: 'Who hums the wrong tune confidently?', type: 'fake', tags: ['entertainment'] },
  { id: '147', text: 'Who could win a movie trivia night?', type: 'group', tags: ['entertainment'] },
  { id: '148', text: 'Who thinks Star Wars is a Marvel movie?', type: 'fake', tags: ['entertainment'] },
  { id: '149', text: 'Who has the best playlist?', type: 'group', tags: ['entertainment'] },
  { id: '150', text: 'Who only listens to elevator music?', type: 'fake', tags: ['entertainment'] },
  { id: '151', text: 'Who dances even when there\'s no music?', type: 'group', tags: ['entertainment'] },
  { id: '152', text: 'Who freezes every time they dance?', type: 'fake', tags: ['entertainment'] },
  { id: '153', text: 'Who could binge-watch for 12 hours straight?', type: 'group', tags: ['entertainment'] },
  { id: '154', text: 'Who falls asleep during episode one?', type: 'fake', tags: ['entertainment'] },

  // 🤪 Silly / Embarrassing
  { id: '155', text: 'Who would trip over flat ground?', type: 'group', tags: ['silly'] },
  { id: '156', text: 'Who somehow always lands gracefully?', type: 'fake', tags: ['silly'] },
  { id: '157', text: 'Who laughs at memes for hours?', type: 'group', tags: ['silly'] },
  { id: '158', text: 'Who doesn\'t understand any memes?', type: 'fake', tags: ['silly'] },
  { id: '159', text: 'Who would text the wrong group chat?', type: 'group', tags: ['silly'] },
  { id: '160', text: 'Who double-checks every message?', type: 'fake', tags: ['silly'] },
  { id: '161', text: 'Who would trip on stage at graduation?', type: 'group', tags: ['silly'] },
  { id: '162', text: 'Who would correct everyone else\'s posture?', type: 'fake', tags: ['silly'] },
  { id: '163', text: 'Who laughs hardest at their own jokes?', type: 'group', tags: ['silly'] },
  { id: '164', text: 'Who stays silent even when it\'s hilarious?', type: 'fake', tags: ['silly'] },

  // 🎲 Random / Creative
  { id: '165', text: 'Who would start their own business successfully?', type: 'group', tags: ['random'] },
  { id: '166', text: 'Who would forget to file taxes for it?', type: 'fake', tags: ['random'] },
  { id: '167', text: 'Who is the most creative problem-solver?', type: 'group', tags: ['random'] },
  { id: '168', text: 'Who creates more chaos than solutions?', type: 'fake', tags: ['random'] },
  { id: '169', text: 'Who could win a game show?', type: 'group', tags: ['random'] },
  { id: '170', text: 'Who would lose on the first question?', type: 'fake', tags: ['random'] },
  { id: '171', text: 'Who would make the best detective?', type: 'group', tags: ['random'] },
  { id: '172', text: 'Who would confess to a crime they didn\'t commit?', type: 'fake', tags: ['random'] },
  { id: '173', text: 'Who could live in a tiny home happily?', type: 'group', tags: ['random'] },
  { id: '174', text: 'Who needs five closets and two kitchens?', type: 'fake', tags: ['random'] },
  { id: '175', text: 'Who would volunteer for a space mission?', type: 'group', tags: ['random'] },
  { id: '176', text: 'Who would cry when the WiFi disconnects?', type: 'fake', tags: ['random'] },
  { id: '177', text: 'Who would accidentally go viral on the internet?', type: 'group', tags: ['random'] },
  { id: '178', text: 'Who would delete their account in embarrassment?', type: 'fake', tags: ['random'] },
  { id: '179', text: 'Who would win a "best dressed" award?', type: 'group', tags: ['random'] },
  { id: '180', text: 'Who would show up wearing pajamas?', type: 'fake', tags: ['random'] },
  { id: '181', text: 'Who would survive a horror movie?', type: 'group', tags: ['random'] },
  { id: '182', text: 'Who would check the basement alone?', type: 'fake', tags: ['random'] },
  { id: '183', text: 'Who is most likely to invent something useful?', type: 'group', tags: ['random'] },
  { id: '184', text: 'Who would patent something that already exists?', type: 'fake', tags: ['random'] },

  // 🧩 Bonus Round — Personality Mashups
  { id: '185', text: 'Who gives main character energy?', type: 'group', tags: ['personality'] },
  { id: '186', text: 'Who insists they\'re just a side character?', type: 'fake', tags: ['personality'] },
  { id: '187', text: 'Who is secretly the villain of the friend group?', type: 'fake', tags: ['personality'] },
  { id: '188', text: 'Who would narrate their own life like a movie?', type: 'group', tags: ['personality'] },
  { id: '189', text: 'Who could pass as a motivational speaker?', type: 'group', tags: ['personality'] },
  { id: '190', text: 'Who demotivates everyone by accident?', type: 'fake', tags: ['personality'] },
  { id: '191', text: 'Who is the "therapist friend"?', type: 'group', tags: ['personality'] },
  { id: '192', text: 'Who gives advice they never follow?', type: 'fake', tags: ['personality'] },
  { id: '193', text: 'Who would be everyone\'s favorite in a sitcom?', type: 'group', tags: ['personality'] },
  { id: '194', text: 'Who would get written out by episode two?', type: 'fake', tags: ['personality'] },

  // Extra Randoms
  { id: '195', text: 'Who could fall asleep anywhere?', type: 'group', tags: ['lifestyle', 'silly'] },
  { id: '196', text: 'Who can\'t sleep unless it\'s pitch dark and silent?', type: 'fake', tags: ['lifestyle', 'silly'] },
  { id: '197', text: 'Who would host their own talk show?', type: 'group', tags: ['entertainment'] },
  { id: '198', text: 'Who would be the awkward guest?', type: 'fake', tags: ['entertainment'] },
  { id: '199', text: 'Who could talk their way out of any situation?', type: 'group', tags: ['personality'] },
  { id: '200', text: 'Who would talk themselves into more trouble?', type: 'fake', tags: ['personality'] },
  { id: '201', text: 'Who is always the first to volunteer?', type: 'group', tags: ['school', 'work'] },
  { id: '202', text: 'Who mysteriously disappears when help is needed?', type: 'fake', tags: ['school', 'work'] },
  { id: '203', text: 'Who would bake cookies for the team?', type: 'group', tags: ['social', 'lifestyle'] },
  { id: '204', text: 'Who would eat all the cookies first?', type: 'fake', tags: ['social', 'lifestyle'] },
];

// In-memory storage (replace with Redis in production)
const rooms = new Map<string, Room>();
const userSockets = new Map<string, string>(); // userId -> socketId

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://fakeout.fly.dev", "https://your-custom-domain.com"] 
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

// Get random question pair (group + fake) with diversity to avoid obvious opposites
// Tracks used questions to ensure all questions are used before repeating
function getDiverseQuestionPair(room: Room): { group: Question; fake: Question } {
  // Check if all questions have been used, reset if so
  if (room.usedQuestionIds.size >= SAMPLE_QUESTIONS.length) {
    console.log(`All questions used for room ${room.pin}, resetting usedQuestionIds`);
    room.usedQuestionIds.clear();
  }

  // Filter out already used questions
  const availableGroupQuestions = SAMPLE_QUESTIONS.filter(q => 
    q.type === 'group' && !room.usedQuestionIds.has(q.id)
  );
  const availableFakeQuestions = SAMPLE_QUESTIONS.filter(q => 
    q.type === 'fake' && !room.usedQuestionIds.has(q.id)
  );

  // If no unused questions of one type remain, reset and use all questions
  if (availableGroupQuestions.length === 0 || availableFakeQuestions.length === 0) {
    console.log(`Ran out of unused questions for room ${room.pin}, resetting`);
    room.usedQuestionIds.clear();
    const allGroupQuestions = SAMPLE_QUESTIONS.filter(q => q.type === 'group');
    const allFakeQuestions = SAMPLE_QUESTIONS.filter(q => q.type === 'fake');
    
    // Safety check
    if (allGroupQuestions.length === 0 || allFakeQuestions.length === 0) {
      console.error(`No questions available in question bank!`);
      // Fallback to first available questions
      const fallbackGroup = SAMPLE_QUESTIONS.find(q => q.type === 'group');
      const fallbackFake = SAMPLE_QUESTIONS.find(q => q.type === 'fake');
      if (!fallbackGroup || !fallbackFake) {
        throw new Error('No questions available in question bank');
      }
      return { group: fallbackGroup, fake: fallbackFake };
    }
    
    const randomGroupIndex = randomInt(0, allGroupQuestions.length);
    const groupQuestion = allGroupQuestions[randomGroupIndex];
    
    // Prefer fake questions that are NOT the sequential opposite and have different tags
    const preferredPool = allFakeQuestions.filter(q => {
      const notOpposite = Math.abs(Number(q.id) - Number(groupQuestion.id)) !== 1;
      const differentTag = groupQuestion.tags && q.tags
        ? !groupQuestion.tags.some(t => (q.tags || []).includes(t))
        : true;
      return notOpposite && differentTag;
    });

    const fallbackPool = allFakeQuestions.filter(q => Math.abs(Number(q.id) - Number(groupQuestion.id)) !== 1);
    const usablePool = preferredPool.length > 0 ? preferredPool : (fallbackPool.length > 0 ? fallbackPool : allFakeQuestions);

    // Safety check
    let fakeQuestion: Question;
    if (usablePool.length === 0) {
      console.error(`No usable fake questions found for room ${room.pin}, using fallback`);
      const fallbackFake = allFakeQuestions[0];
      if (!fallbackFake) {
        throw new Error('No fake questions available');
      }
      fakeQuestion = fallbackFake;
    } else {
      const randomFakeIndex = randomInt(0, usablePool.length);
      fakeQuestion = usablePool[randomFakeIndex];
    }
    
    // Mark both questions as used
    room.usedQuestionIds.add(groupQuestion.id);
    room.usedQuestionIds.add(fakeQuestion.id);
    
    return { group: groupQuestion, fake: fakeQuestion };
  }

  // Safety check
  if (availableGroupQuestions.length === 0 || availableFakeQuestions.length === 0) {
    console.error(`No available questions for room ${room.pin}`);
    // Reset and try again
    room.usedQuestionIds.clear();
    return getDiverseQuestionPair(room);
  }

  // Select from unused questions
  const randomGroupIndex = randomInt(0, availableGroupQuestions.length);
  const groupQuestion = availableGroupQuestions[randomGroupIndex];

  // Prefer fake questions that are NOT the sequential opposite, have different tags, and haven't been used
  const preferredPool = availableFakeQuestions.filter(q => {
    const notOpposite = Math.abs(Number(q.id) - Number(groupQuestion.id)) !== 1;
    const differentTag = groupQuestion.tags && q.tags
      ? !groupQuestion.tags.some(t => (q.tags || []).includes(t))
      : true;
    return notOpposite && differentTag;
  });

  const fallbackPool = availableFakeQuestions.filter(q => Math.abs(Number(q.id) - Number(groupQuestion.id)) !== 1);
  const usablePool = preferredPool.length > 0 ? preferredPool : (fallbackPool.length > 0 ? fallbackPool : availableFakeQuestions);

  // Safety check
  let fakeQuestion: Question;
  if (usablePool.length === 0) {
    console.error(`No usable fake questions found for room ${room.pin}, using fallback`);
    const fallbackFake = availableFakeQuestions[0];
    if (!fallbackFake) {
      throw new Error('No fake questions available');
    }
    fakeQuestion = fallbackFake;
  } else {
    const randomFakeIndex = randomInt(0, usablePool.length);
    fakeQuestion = usablePool[randomFakeIndex];
  }

  // Mark both questions as used
  room.usedQuestionIds.add(groupQuestion.id);
  room.usedQuestionIds.add(fakeQuestion.id);

  console.log(`Room ${room.pin}: Used questions ${groupQuestion.id} and ${fakeQuestion.id}. Total used: ${room.usedQuestionIds.size}/${SAMPLE_QUESTIONS.length}`);

  return { group: groupQuestion, fake: fakeQuestion };
}

// REST API Routes
app.post('/api/rooms', (req, res) => {
  const { hostId, displayName } = req.body;
  
  if (!hostId || !displayName) {
    return res.status(400).json({ error: 'Missing hostId or displayName' });
  }

  const roomId = uuidv4();
  const pin = generatePin();
  
  console.log(`Creating room with PIN: ${pin} for host: ${hostId}`);
  
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
    scores: new Map(),
    usedQuestionIds: new Set(),
    disconnectTimeouts: new Map()
  };
  
  rooms.set(pin, room);
  console.log(`Room ${pin} created successfully. Total rooms: ${rooms.size}`);
  
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
    console.log(`Player ${displayName} (${userId}) trying to join room ${pin}`);
    const room = rooms.get(pin);
    
    if (!room) {
      console.log(`Room ${pin} not found. Available rooms:`, Array.from(rooms.keys()));
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    console.log(`Room ${pin} found. Current players:`, room.players.size);

    // Enforce max connected players in lobby (reconnections still allowed)
    const connectedCount = Array.from(room.players.values()).filter(p => p.status === 'connected').length;
    if (room.state === 'lobby' && connectedCount >= MAX_PLAYERS) {
      socket.emit('error', { message: `Room is full (max ${MAX_PLAYERS} players)` });
      return;
    }
    
    // Allow rejoining during active games, but block new players
    if (room.state !== 'lobby') {
      // Check if this is a reconnection attempt (user was previously in the room)
      const existingUser = room.players.get(userId);
      if (!existingUser || existingUser.status === 'connected') {
        socket.emit('error', { message: 'Game already in progress' });
        return;
      }
    }

    // Enforce unique player names (case-insensitive, trimmed)
    const normalizedName = (displayName || '').trim();
    if (!normalizedName) {
      socket.emit('error', { message: 'Display name is required' });
      return;
    }
    
    // Check for name conflicts - only block if there's a connected player with the same name
    const nameTaken = Array.from(room.players.values()).some(
      (p) => p.displayName.trim().toLowerCase() === normalizedName.toLowerCase() && p.status === 'connected'
    );
    if (nameTaken) {
      socket.emit('error', { message: 'That player name is already in use. Pick another name.' });
      return;
    }
    
    // Check if this is a reconnection attempt
    const existingUser = room.players.get(userId);
    if (existingUser && existingUser.status === 'disconnected') {
      // This is a reconnection - restore the user
      existingUser.socketId = socket.id;
      existingUser.status = 'connected';
      existingUser.disconnectedAt = undefined;
      
      // Clear any pending disconnect timeout
      if (room.disconnectTimeouts?.has(userId)) {
        clearTimeout(room.disconnectTimeouts.get(userId)!);
        room.disconnectTimeouts.delete(userId);
      }
      
      console.log(`Player ${displayName} reconnected to room ${pin}`);
    } else {
      // This is a new player joining
      // Check if there's a disconnected player with the same name
      const disconnectedPlayer = Array.from(room.players.values()).find(
        (p) => p.displayName.trim().toLowerCase() === normalizedName.toLowerCase() && p.status === 'disconnected'
      );
      
      if (disconnectedPlayer) {
        socket.emit('error', { 
          message: 'A disconnected player with that name exists. Please wait for them to reconnect or use a different name.',
          rejoinAvailable: true 
        });
        return;
      }
      
      // Create new user
      const user: User = { 
        id: userId, 
        displayName: normalizedName, 
        socketId: socket.id, 
        status: 'connected' 
      };
      room.players.set(userId, user);
      room.scores.set(userId, 0);
      console.log(`Added new player: ${normalizedName} (${userId}) to room ${pin}. Total players now: ${room.players.size}`);
    }
    
    userSockets.set(userId, socket.id);
    
    socket.join(pin);
    
    // Broadcast updated player list
    const players = Array.from(room.players.values()).map(p => ({
      id: p.id,
      displayName: p.displayName,
      status: p.status
    }));
    
    console.log(`Broadcasting room update to ${pin}. Players:`, players.length);
    io.to(pin).emit('room:update', { players, state: room.state });
    socket.emit('room:joined', { roomId: room.id, pin });
    
    // If this was a reconnection during an active game, send the current game state
    const reconnectedUser = room.players.get(userId);
    if (reconnectedUser && room.state !== 'lobby' && room.currentRoundData) {
      if (room.state === 'answering') {
        const isFake = userId === room.currentRoundData.fakeId;
        const question = isFake ? room.currentRoundData.fakeQuestion : room.currentRoundData.groupQuestion;
        socket.emit('round:start', {
          roundNumber: room.currentRound,
          timer: room.settings.answerTimer
        });
        socket.emit(isFake ? 'prompt:fake' : 'prompt:group', {
          text: question,
          players
        });
      } else if (room.state === 'discussing') {
        socket.emit('discussion:start', {
          timer: room.settings.discussionTimer,
          question: room.currentRoundData.groupQuestion
        });
      } else if (room.state === 'voting') {
        socket.emit('voting:start', {
          timer: room.settings.voteTimer,
          players
        });
      }
    }
    
    console.log(`Player ${displayName} successfully joined room ${pin}`);
  });

  socket.on('room:host-join', (data) => {
    const { pin, userId, displayName } = data;
    console.log(`Host ${displayName} (${userId}) trying to join room ${pin}`);
    const room = rooms.get(pin);
    
    if (!room) {
      console.log(`Room ${pin} not found for host. Available rooms:`, Array.from(rooms.keys()));
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    console.log(`Host joining room ${pin}. Current players:`, room.players.size);
    
    // Host doesn't join as a player - they just connect to manage the room
    userSockets.set(userId, socket.id);
    socket.join(pin);
    console.log(`Host socket ${socket.id} joined room ${pin}`);
    
    // Send current room state to host
    const players = Array.from(room.players.values()).map(p => ({
      id: p.id,
      displayName: p.displayName,
      status: p.status
    }));
    
    socket.emit('room:joined', { roomId: room.id, pin });
    socket.emit('room:update', { players, state: room.state });
    console.log(`Host successfully joined room ${pin} and received initial state with ${players.length} players`);
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
          const players = Array.from(room.players.values()).map(p => ({ 
            id: p.id, 
            displayName: p.displayName, 
            status: p.status 
          }));
          socket.emit('room:update', { players, state: room.state });
          // If a round is active, resend their current prompt
          if (room.state === 'answering' && room.currentRoundData) {
            const isFake = user.id === room.currentRoundData.fakeId;
            const question = isFake ? room.currentRoundData.fakeQuestion : room.currentRoundData.groupQuestion;
            socket.emit(isFake ? 'prompt:fake' : 'prompt:group', {
              text: question,
              players
            });
          }
        }
      }
    }
  });

  // Handle player reconnection with same name
  socket.on('room:rejoin', (data) => {
    const { pin, userId, displayName } = data;
    console.log(`Player ${displayName} (${userId}) trying to rejoin room ${pin}`);
    const room = rooms.get(pin);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    // Check if user was previously in this room and is within grace period
    const existingUser = room.players.get(userId);
    if (!existingUser) {
      socket.emit('error', { message: 'User not found in this room' });
      return;
    }
    
    if (existingUser.status === 'connected') {
      socket.emit('error', { message: 'You are already connected' });
      return;
    }
    
    // Check if still within grace period
    if (existingUser.disconnectedAt) {
      const timeSinceDisconnect = Date.now() - existingUser.disconnectedAt.getTime();
      if (timeSinceDisconnect > DISCONNECT_GRACE_PERIOD) {
        socket.emit('error', { message: 'Reconnection grace period expired' });
        return;
      }
    }
    
    // Restore user connection
    existingUser.socketId = socket.id;
    existingUser.status = 'connected';
    existingUser.disconnectedAt = undefined;
    
    // Clear any pending disconnect timeout
    if (room.disconnectTimeouts?.has(userId)) {
      clearTimeout(room.disconnectTimeouts.get(userId)!);
      room.disconnectTimeouts.delete(userId);
    }
    
    userSockets.set(userId, socket.id);
    socket.join(pin);
    
    // Broadcast updated player list
    const players = Array.from(room.players.values()).map(p => ({
      id: p.id,
      displayName: p.displayName,
      status: p.status
    }));
    
    console.log(`Player ${displayName} successfully rejoined room ${pin}`);
    io.to(pin).emit('room:update', { players, state: room.state });
    socket.emit('room:joined', { roomId: room.id, pin });
    
    // If a round is active, resend their current prompt and state
    if (room.currentRoundData) {
      if (room.state === 'answering') {
        const isFake = userId === room.currentRoundData.fakeId;
        const question = isFake ? room.currentRoundData.fakeQuestion : room.currentRoundData.groupQuestion;
        socket.emit(isFake ? 'prompt:fake' : 'prompt:group', {
          text: question,
          players
        });
        socket.emit('round:start', {
          roundNumber: room.currentRound,
          timer: room.settings.answerTimer
        });
      } else if (room.state === 'discussing') {
        socket.emit('discussion:start', {
          timer: room.settings.discussionTimer,
          question: room.currentRoundData.groupQuestion
        });
      } else if (room.state === 'voting') {
        socket.emit('voting:start', {
          timer: room.settings.voteTimer,
          players
        });
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
    const connectedPlayers = Array.from(room.players.values()).filter(p => p.status === 'connected');
    
    if (players.length < 3) {
      socket.emit('error', { message: 'Need at least 3 players to start' });
      return;
    }
    
    if (connectedPlayers.length < 3) {
      socket.emit('error', { message: 'Need at least 3 connected players to start the game' });
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
    
    console.log('Sending answers update:', answerData);
    console.log('Current room players:', Array.from(room.players.keys()));
    
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

  // Skip to voting handler (host only)
  socket.on('discussion:skip-to-voting', (data) => {
    const { pin, hostId } = data;
    const room = rooms.get(pin);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    // Check if the user is the host
    if (room.hostUserId !== hostId) {
      socket.emit('error', { message: 'Only the host can skip to voting' });
      return;
    }
    
    if (room.state !== 'discussing') {
      socket.emit('error', { message: 'Not in discussion phase' });
      return;
    }
    
    console.log('Host skipping to voting for room:', pin);
    
    // Clear the discussion timer
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = undefined;
    }
    
    // Clear the discussion timeout
    if (room.discussionTimeout) {
      clearTimeout(room.discussionTimeout);
      room.discussionTimeout = undefined;
    }
    
    // Start voting phase immediately
    startVoting(room);
  });

  socket.on('player:kick', (data) => {
    const { pin, targetUserId } = data;
    const room = rooms.get(pin);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    // Verify the requester is the host
    const requesterUserId = getUserIdFromSocket(socket.id);
    if (requesterUserId !== room.hostUserId) {
      socket.emit('error', { message: 'Only the host can kick players' });
      return;
    }
    
    // Prevent host from kicking themselves (host is not in players map)
    const targetPlayer = room.players.get(targetUserId);
    if (!targetPlayer) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }
    
    console.log(`Host ${requesterUserId} kicking player ${targetPlayer.displayName} (${targetUserId}) from room ${pin}`);
    
    // Cancel any disconnect timeout for this player
    if (room.disconnectTimeouts?.has(targetUserId)) {
      clearTimeout(room.disconnectTimeouts.get(targetUserId)!);
      room.disconnectTimeouts.delete(targetUserId);
    }
    
    // Remove player from room
    room.players.delete(targetUserId);
    room.scores.delete(targetUserId);
    
    // Remove from current round data if present
    if (room.currentRoundData) {
      room.currentRoundData.answers.delete(targetUserId);
      room.currentRoundData.votes.delete(targetUserId);
    }
    
    // Disconnect the player's socket
    const targetSocketId = targetPlayer.socketId;
    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.emit('player:kicked', { message: 'You have been kicked from the game by the host' });
        targetSocket.leave(room.pin);
      }
    }
    
    // Remove from userSockets
    userSockets.delete(targetUserId);
    
    // Broadcast updated player list to all remaining players (including host)
    const players = Array.from(room.players.values()).map(p => ({
      id: p.id,
      displayName: p.displayName,
      status: p.status
    }));
    
    console.log(`Broadcasting room:update to room ${pin} with ${players.length} players`);
    io.to(room.pin).emit('room:update', { players, state: room.state });
    
    // Also explicitly send to the host socket to ensure they get the update
    const hostSocketId = userSockets.get(room.hostUserId);
    if (hostSocketId) {
      const hostSocket = io.sockets.sockets.get(hostSocketId);
      if (hostSocket) {
        console.log(`Explicitly sending room:update to host socket ${hostSocketId}`);
        hostSocket.emit('room:update', { players, state: room.state });
      }
    }
    
    console.log(`Player ${targetPlayer.displayName} (${targetUserId}) was kicked from room ${pin} by host`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Handle player disconnect with grace period
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        // Mark as disconnected in all rooms instead of removing immediately
        for (const room of rooms.values()) {
          if (room.players.has(userId)) {
            const user = room.players.get(userId)!;
            user.status = 'disconnected';
            user.disconnectedAt = new Date();
            
            // Set timeout to actually remove player after grace period
            const disconnectTimeout = setTimeout(() => {
              console.log(`Removing player ${userId} from room ${room.pin} after grace period`);
              room.players.delete(userId);
              room.scores.delete(userId);
              room.disconnectTimeouts?.delete(userId);
              
              // Broadcast updated player list
              const players = Array.from(room.players.values()).map(p => ({
                id: p.id,
                displayName: p.displayName,
                status: p.status
              }));
              io.to(room.pin).emit('room:update', { players, state: room.state });
            }, DISCONNECT_GRACE_PERIOD);
            
            // Store timeout for potential cancellation if player reconnects
            if (!room.disconnectTimeouts) {
              room.disconnectTimeouts = new Map();
            }
            room.disconnectTimeouts.set(userId, disconnectTimeout);
            
            // Broadcast updated player list with disconnected status
            const players = Array.from(room.players.values()).map(p => ({
              id: p.id,
              displayName: p.displayName,
              status: p.status
            }));
            io.to(room.pin).emit('room:update', { players, state: room.state });
            
            console.log(`Player ${user.displayName} marked as disconnected in room ${room.pin}`);
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

// Fisher-Yates shuffle for true randomization using Node.js crypto
function shuffleArray<T>(array: T[]): T[] {
  if (array.length === 0) {
    return [];
  }
  if (array.length === 1) {
    return [...array];
  }
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Use Node.js crypto.randomInt for cryptographically secure randomness
    // randomInt(0, i+1) generates a number from 0 to i (inclusive)
    const randomIndex = randomInt(0, i + 1);
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }
  return shuffled;
}

function startRound(room: Room) {
  room.currentRound++;
  room.state = 'answering';
  console.log(`Starting round ${room.currentRound} for room ${room.pin}`);
  
  // Clear any existing results timeout
  if (room.resultsTimeout) {
    clearTimeout(room.resultsTimeout);
    room.resultsTimeout = undefined;
  }
  
  // Get all player IDs (including disconnected ones for now)
  const playerIds = Array.from(room.players.keys());
  console.log(`Room ${room.pin} round ${room.currentRound}: Found ${playerIds.length} total players, ${room.players.size} in map`);
  
  // Safety check: ensure we have players
  if (playerIds.length === 0 || room.players.size === 0) {
    console.error(`No players in room ${room.pin} for round ${room.currentRound}. Cannot start round.`);
    room.state = 'lobby';
    io.to(room.pin).emit('error', { message: 'No players available to start round' });
    return;
  }
  
  // Shuffle players array to avoid predictable patterns based on insertion order
  const players = shuffleArray(playerIds);
  
  // Select random fake from shuffled array using Node.js crypto for better randomness
  // Additional safety check
  if (players.length === 0) {
    console.error(`Players array is empty after shuffle for room ${room.pin}`);
    return;
  }
  
  const randomIndex = randomInt(0, players.length);
  const fakeId = players[randomIndex];
  
  console.log(`Round ${room.currentRound}: Selected fake player: ${fakeId} from ${players.length} players`);
  
  const { group, fake } = getDiverseQuestionPair(room);
  
  room.currentRoundData = {
    fakeId,
    groupQuestion: group.text,
    fakeQuestion: fake.text,
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
    
    const isFake = playerId === fakeId;
    const question = isFake ? fake.text : group.text;
    
    io.to(user.socketId).emit(isFake ? 'prompt:fake' : 'prompt:group', {
      text: question,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        displayName: p.displayName
      }))
    });
  });
  
  // Start timer for answering phase
  const answerTimeout = setTimeout(() => {
    if (room.state === 'answering') {
      startDiscussion(room);
    }
  }, room.settings.answerTimer * 1000);
  
  // Store the timeout ID for potential early termination
  room.answerTimeout = answerTimeout;
}

function startDiscussion(room: Room) {
  room.state = 'discussing';
  
  // Clear any existing answer timeout
  if (room.answerTimeout) {
    clearTimeout(room.answerTimeout);
    room.answerTimeout = undefined;
  }
  
  io.to(room.pin).emit('discussion:start', {
    timer: room.settings.discussionTimer,
    question: room.currentRoundData?.groupQuestion
  });
  
  // Start server-side timer sync
  startTimerSync(room, room.settings.discussionTimer);
  
  // Start timer for discussion phase
  const discussionTimeout = setTimeout(() => {
    if (room.state === 'discussing') {
      startVoting(room);
    }
  }, room.settings.discussionTimer * 1000);
  
  // Store the timeout ID for potential early termination
  room.discussionTimeout = discussionTimeout;
}

function startVoting(room: Room) {
  room.state = 'voting';
  
  // Clear any existing discussion timeout
  if (room.discussionTimeout) {
    clearTimeout(room.discussionTimeout);
    room.discussionTimeout = undefined;
  }
  
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
  const voteTimeout = setTimeout(() => {
    if (room.state === 'voting') {
      calculateResults(room);
    }
  }, room.settings.voteTimer * 1000);
  
  // Store the timeout ID for potential early termination
  room.voteTimeout = voteTimeout;
}

function calculateResults(room: Room) {
  if (!room.currentRoundData) return;
  
  console.log(`Calculating results for round ${room.currentRound} in room ${room.pin}`);
  room.state = 'results';
  
  // Clear any existing vote timeout
  if (room.voteTimeout) {
    clearTimeout(room.voteTimeout);
    room.voteTimeout = undefined;
  }
  
  const { fakeId, votes, fakeQuestion } = room.currentRoundData;
  
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
  const fakeCaught = mostVotedPlayer === fakeId && maxVotes > room.players.size / 2;
  
  if (fakeCaught) {
    // Everyone except fake gets +1 point
    for (const playerId of room.players.keys()) {
      if (playerId !== fakeId) {
        room.scores.set(playerId, (room.scores.get(playerId) || 0) + 1);
      }
    }
  } else {
    // Fake gets +3 points
    room.scores.set(fakeId, (room.scores.get(fakeId) || 0) + 3);
  }
  
  // Send results
  const scores = Array.from(room.scores.entries()).map(([userId, score]) => ({
    userId,
    displayName: room.players.get(userId)?.displayName || 'Unknown',
    score
  }));
  
  io.to(room.pin).emit('round:result', {
    fakeId,
    fakeCaught,
    fakeQuestion,
    votes: Array.from(votes.entries()),
    scores
  });
  
  // Start server-side timer sync for results phase
  startTimerSync(room, 5); // Show results for 5 seconds
  
  // Start timer for results phase
  const resultsTimeout = setTimeout(() => {
    if (room.currentRound >= room.settings.rounds) {
      endGame(room);
    } else {
      startRound(room);
    }
  }, 5000); // Show results for 5 seconds
  
  // Store the timeout ID for potential early termination
  room.resultsTimeout = resultsTimeout;
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