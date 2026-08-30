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
  // Personality (more)
  { id: '95', text: 'Who is the most honest?', tags: ['personality'] },
  { id: '96', text: 'Who bends the truth the most?', tags: ['personality'] },
  { id: '97', text: 'Who is the most patient?', tags: ['personality'] },
  { id: '98', text: 'Who has the shortest fuse?', tags: ['personality'] },
  { id: '99', text: 'Who is the most confident?', tags: ['personality'] },
  { id: '100', text: 'Who doubts themselves the most?', tags: ['personality'] },
  { id: '101', text: 'Who is the most generous?', tags: ['personality'] },
  { id: '102', text: 'Who is the stingiest?', tags: ['personality'] },
  { id: '103', text: 'Who is the most stubborn?', tags: ['personality'] },
  { id: '104', text: 'Who changes their mind the easiest?', tags: ['personality'] },
  { id: '105', text: 'Who is the most curious?', tags: ['personality'] },
  { id: '106', text: 'Who asks the fewest questions?', tags: ['personality'] },
  { id: '107', text: 'Who is the most ambitious?', tags: ['personality'] },
  { id: '108', text: 'Who is the most content with less?', tags: ['personality'] },
  { id: '109', text: 'Who is the most humble?', tags: ['personality'] },
  { id: '110', text: 'Who brags the most?', tags: ['personality'] },
  { id: '111', text: 'Who is the most sarcastic?', tags: ['personality'] },
  { id: '112', text: 'Who takes things the most literally?', tags: ['personality'] },
  { id: '113', text: 'Who is the biggest optimist?', tags: ['personality'] },
  { id: '114', text: 'Who is the biggest pessimist?', tags: ['personality'] },
  { id: '115', text: 'Who holds a grudge the longest?', tags: ['personality'] },
  { id: '116', text: 'Who forgives the fastest?', tags: ['personality'] },
  { id: '117', text: 'Who is the most forgetful?', tags: ['personality'] },
  { id: '118', text: 'Who never forgets a birthday?', tags: ['personality'] },
  { id: '119', text: 'Who is the most punctual?', tags: ['personality'] },
  { id: '120', text: 'Who is always running late?', tags: ['personality'] },
  { id: '121', text: 'Who is the most loyal?', tags: ['personality'] },
  { id: '122', text: 'Who is the most jealous?', tags: ['personality'] },
  { id: '123', text: 'Who is the most grateful?', tags: ['personality'] },
  { id: '124', text: 'Who takes things the most personally?', tags: ['personality'] },
  { id: '125', text: 'Who has the thickest skin?', tags: ['personality'] },
  { id: '126', text: 'Who is the biggest perfectionist?', tags: ['personality'] },
  { id: '127', text: 'Who is the most easygoing?', tags: ['personality'] },
  { id: '128', text: 'Who is the most unpredictable?', tags: ['personality'] },
  { id: '129', text: 'Who is the most vain?', tags: ['personality'] },
  { id: '130', text: 'Who is the most modest?', tags: ['personality'] },
  { id: '131', text: 'Who gets nostalgic the most?', tags: ['personality'] },

  // School / Work (more)
  { id: '132', text: 'Who is the best multitasker?', tags: ['school', 'work'] },
  { id: '133', text: 'Who can only focus on one thing at a time?', tags: ['school', 'work'] },
  { id: '134', text: 'Who takes the most detailed notes?', tags: ['school', 'work'] },
  { id: '135', text: 'Who never takes notes?', tags: ['school', 'work'] },
  { id: '136', text: 'Who carries the group project?', tags: ['school', 'work'] },
  { id: '137', text: 'Who does the least in group projects?', tags: ['school', 'work'] },
  { id: '138', text: 'Who always meets deadlines early?', tags: ['school', 'work'] },
  { id: '139', text: 'Who waits until the last possible minute?', tags: ['school', 'work'] },
  { id: '140', text: 'Who writes the longest emails?', tags: ['school', 'work'] },
  { id: '141', text: 'Who never replies to emails?', tags: ['school', 'work'] },
  { id: '142', text: 'Who talks the most in meetings?', tags: ['school', 'work'] },
  { id: '143', text: 'Who says the least in meetings?', tags: ['school', 'work'] },
  { id: '144', text: 'Who is most afraid to ask for help?', tags: ['school', 'work'] },
  { id: '145', text: 'Who asks for help the fastest?', tags: ['school', 'work'] },
  { id: '146', text: 'Who delegates the best?', tags: ['school', 'work'] },
  { id: '147', text: 'Who insists on doing everything themselves?', tags: ['school', 'work'] },
  { id: '148', text: 'Who would negotiate the best raise?', tags: ['school', 'work'] },
  { id: '149', text: 'Who would never ask for a raise?', tags: ['school', 'work'] },
  { id: '150', text: 'Who works best from home?', tags: ['school', 'work'] },
  { id: '151', text: 'Who gets nothing done from home?', tags: ['school', 'work'] },
  { id: '152', text: 'Who dresses the most professionally?', tags: ['school', 'work'] },
  { id: '153', text: 'Who dresses the most casually for work?', tags: ['school', 'work'] },
  { id: '154', text: 'Who is the best at networking?', tags: ['school', 'work'] },
  { id: '155', text: 'Who is the most awkward at networking events?', tags: ['school', 'work'] },
  { id: '156', text: 'Who gives the best toast?', tags: ['school', 'work'] },
  { id: '157', text: 'Who would ramble the longest in a toast?', tags: ['school', 'work'] },
  { id: '158', text: 'Who types the fastest?', tags: ['school', 'work'] },
  { id: '159', text: 'Who still hunts and pecks on a keyboard?', tags: ['school', 'work'] },
  { id: '160', text: 'Who has the neatest handwriting?', tags: ['school', 'work'] },
  { id: '161', text: 'Who has the worst handwriting?', tags: ['school', 'work'] },
  { id: '162', text: 'Who studies the hardest?', tags: ['school', 'work'] },
  { id: '163', text: 'Who crams the night before?', tags: ['school', 'work'] },
  { id: '164', text: 'Who has pulled the most all-nighters?', tags: ['school', 'work'] },
  { id: '165', text: 'Who falls asleep the earliest?', tags: ['school', 'work'] },
  { id: '166', text: 'Who is the best at buttering up the boss?', tags: ['school', 'work'] },
  { id: '167', text: 'Who is most likely to take credit for someone else\'s work?', tags: ['school', 'work'] },
  { id: '168', text: 'Who works best under pressure?', tags: ['school', 'work'] },
  { id: '169', text: 'Who panics under pressure?', tags: ['school', 'work'] },
  { id: '170', text: 'Who would make the most sudden career change?', tags: ['school', 'work'] },
  { id: '171', text: 'Who would never leave a stable job?', tags: ['school', 'work'] },

  // Lifestyle (more)
  { id: '172', text: 'Who keeps the cleanest room?', tags: ['lifestyle'] },
  { id: '173', text: 'Who has the messiest room?', tags: ['lifestyle'] },
  { id: '174', text: 'Who does laundry the most often?', tags: ['lifestyle'] },
  { id: '175', text: 'Who lets laundry pile up the longest?', tags: ['lifestyle'] },
  { id: '176', text: 'Who grocery shops the smartest?', tags: ['lifestyle'] },
  { id: '177', text: 'Who always forgets something at the store?', tags: ['lifestyle'] },
  { id: '178', text: 'Who budgets the best?', tags: ['lifestyle'] },
  { id: '179', text: 'Who spends the most impulsively?', tags: ['lifestyle'] },
  { id: '180', text: 'Who saves money the best?', tags: ['lifestyle'] },
  { id: '181', text: 'Who has the best home decor?', tags: ['lifestyle'] },
  { id: '182', text: 'Who can\'t keep a plant alive?', tags: ['lifestyle'] },
  { id: '183', text: 'Who has the greenest thumb?', tags: ['lifestyle'] },
  { id: '184', text: 'Who spoils their pet the most?', tags: ['lifestyle'] },
  { id: '185', text: 'Who bakes the best desserts?', tags: ['lifestyle'] },
  { id: '186', text: 'Who burns everything in the oven?', tags: ['lifestyle'] },
  { id: '187', text: 'Who has the strictest workout routine?', tags: ['lifestyle'] },
  { id: '188', text: 'Who hasn\'t exercised in years?', tags: ['lifestyle'] },
  { id: '189', text: 'Who has the best sleep schedule?', tags: ['lifestyle'] },
  { id: '190', text: 'Who has the worst sleep schedule?', tags: ['lifestyle'] },
  { id: '191', text: 'Who has the longest morning routine?', tags: ['lifestyle'] },
  { id: '192', text: 'Who rolls out of bed and out the door?', tags: ['lifestyle'] },
  { id: '193', text: 'Who is the biggest night owl?', tags: ['lifestyle'] },
  { id: '194', text: 'Who has the most elaborate skincare routine?', tags: ['lifestyle'] },
  { id: '195', text: 'Who has the best fashion sense?', tags: ['lifestyle'] },
  { id: '196', text: 'Who dresses the same every day?', tags: ['lifestyle'] },
  { id: '197', text: 'Who owns the least stuff?', tags: ['lifestyle'] },
  { id: '198', text: 'Who can\'t throw anything away?', tags: ['lifestyle'] },
  { id: '199', text: 'Who is the best at DIY projects?', tags: ['lifestyle'] },
  { id: '200', text: 'Who calls someone else for every little fix?', tags: ['lifestyle'] },
  { id: '201', text: 'Who takes the best care of their car?', tags: ['lifestyle'] },
  { id: '202', text: 'Who\'s overdue for an oil change?', tags: ['lifestyle'] },
  { id: '203', text: 'Who meal preps every week?', tags: ['lifestyle'] },
  { id: '204', text: 'Who orders takeout the most?', tags: ['lifestyle'] },
  { id: '205', text: 'Who always has a coupon ready?', tags: ['lifestyle'] },
  { id: '206', text: 'Who has the most subscriptions they forgot about?', tags: ['lifestyle'] },
  { id: '207', text: 'Who recycles religiously?', tags: ['lifestyle'] },
  { id: '208', text: 'Who is the most tech-savvy?', tags: ['lifestyle'] },
  { id: '209', text: 'Who still struggles with basic tech?', tags: ['lifestyle'] },
  { id: '210', text: 'Who spends the most time on social media?', tags: ['lifestyle'] },
  { id: '211', text: 'Who barely checks their phone?', tags: ['lifestyle'] },
  { id: '212', text: 'Who takes forever to text back?', tags: ['lifestyle'] },
  { id: '213', text: 'Who replies within seconds?', tags: ['lifestyle'] },

  // Social (more)
  { id: '214', text: 'Who makes friends the fastest?', tags: ['social'] },
  { id: '215', text: 'Who takes the longest to warm up to new people?', tags: ['social'] },
  { id: '216', text: 'Who has the biggest friend group?', tags: ['social'] },
  { id: '217', text: 'Who prefers a small, tight-knit circle?', tags: ['social'] },
  { id: '218', text: 'Who is best at small talk?', tags: ['social'] },
  { id: '219', text: 'Who makes small talk painfully awkward?', tags: ['social'] },
  { id: '220', text: 'Who always texts first?', tags: ['social'] },
  { id: '221', text: 'Who waits for everyone else to text first?', tags: ['social'] },
  { id: '222', text: 'Who plans every hangout?', tags: ['social'] },
  { id: '223', text: 'Who cancels plans the most?', tags: ['social'] },
  { id: '224', text: 'Who is the group\'s mediator?', tags: ['social'] },
  { id: '225', text: 'Who stirs the drama?', tags: ['social'] },
  { id: '226', text: 'Who is most active in the group chat?', tags: ['social'] },
  { id: '227', text: 'Who never replies in the group chat?', tags: ['social'] },
  { id: '228', text: 'Who throws the best parties?', tags: ['social'] },
  { id: '229', text: 'Who controls the music at every party?', tags: ['social'] },
  { id: '230', text: 'Who dances like nobody\'s watching?', tags: ['social'] },
  { id: '231', text: 'Who refuses to dance?', tags: ['social'] },
  { id: '232', text: 'Who owns karaoke night?', tags: ['social'] },
  { id: '233', text: 'Who avoids the mic at all costs?', tags: ['social'] },
  { id: '234', text: 'Who gives the best hugs?', tags: ['social'] },
  { id: '235', text: 'Who is the most awkward hugger?', tags: ['social'] },
  { id: '236', text: 'Who remembers the smallest details about people?', tags: ['social'] },
  { id: '237', text: 'Who checks in on friends the most?', tags: ['social'] },
  { id: '238', text: 'Who shows up the latest to everything?', tags: ['social'] },
  { id: '239', text: 'Who is always the first to arrive?', tags: ['social'] },
  { id: '240', text: 'Who introduces people the best?', tags: ['social'] },
  { id: '241', text: 'Who leaves an introduction painfully awkward?', tags: ['social'] },
  { id: '242', text: 'Who is the most oblivious when someone\'s flirting with them?', tags: ['social'] },
  { id: '243', text: 'Who picks up on flirting instantly?', tags: ['social'] },
  { id: '244', text: 'Who ends up third-wheeling the most?', tags: ['social'] },
  { id: '245', text: 'Who is the best matchmaker?', tags: ['social'] },
  { id: '246', text: 'Who is everyone\'s go-to wingman?', tags: ['social'] },
  { id: '247', text: 'Who apologizes first after an argument?', tags: ['social'] },
  { id: '248', text: 'Who says sorry way too much?', tags: ['social'] },
  { id: '249', text: 'Who stands up for their friends the hardest?', tags: ['social'] },
  { id: '250', text: 'Who is the most painfully polite?', tags: ['social'] },
  { id: '251', text: 'Who is the bluntest?', tags: ['social'] },
  { id: '252', text: 'Who reads the room the best?', tags: ['social'] },
  { id: '253', text: 'Who has no idea when to stop talking?', tags: ['social'] },
  { id: '254', text: 'Who overshares the most?', tags: ['social'] },
  { id: '255', text: 'Who keeps everything to themselves?', tags: ['social'] },

  // Adventure (more)
  { id: '256', text: 'Who would go camping with zero complaints?', tags: ['adventure'] },
  { id: '257', text: 'Who would need a five-star hotel within a day?', tags: ['adventure'] },
  { id: '258', text: 'Who would lead the group on a hike?', tags: ['adventure'] },
  { id: '259', text: 'Who would want to turn back ten minutes in?', tags: ['adventure'] },
  { id: '260', text: 'Who would plan the best road trip?', tags: ['adventure'] },
  { id: '261', text: 'Who would fall asleep as soon as the car starts moving?', tags: ['adventure'] },
  { id: '262', text: 'Who is the calmest flyer?', tags: ['adventure'] },
  { id: '263', text: 'Who white-knuckles every flight?', tags: ['adventure'] },
  { id: '264', text: 'Who would be first to jump off a boat into open water?', tags: ['adventure'] },
  { id: '265', text: 'Who wouldn\'t get in the water at all?', tags: ['adventure'] },
  { id: '266', text: 'Who would try bungee jumping without hesitation?', tags: ['adventure'] },
  { id: '267', text: 'Who would need to be pushed off the platform?', tags: ['adventure'] },
  { id: '268', text: 'Who would take up scuba diving?', tags: ['adventure'] },
  { id: '269', text: 'Who would panic underwater?', tags: ['adventure'] },
  { id: '270', text: 'Who would hitchhike across the country?', tags: ['adventure'] },
  { id: '271', text: 'Who would never accept a ride from a stranger?', tags: ['adventure'] },
  { id: '272', text: 'Who would backpack through a foreign country solo?', tags: ['adventure'] },
  { id: '273', text: 'Who wouldn\'t leave home without a full itinerary?', tags: ['adventure'] },
  { id: '274', text: 'Who would haggle the best at a foreign market?', tags: ['adventure'] },
  { id: '275', text: 'Who would pay full price without blinking?', tags: ['adventure'] },
  { id: '276', text: 'Who would try the local street food anywhere?', tags: ['adventure'] },
  { id: '277', text: 'Who would stick to food they recognize?', tags: ['adventure'] },
  { id: '278', text: 'Who would get a tattoo on a whim while traveling?', tags: ['adventure'] },
  { id: '279', text: 'Who would need months to decide on a tattoo?', tags: ['adventure'] },
  { id: '280', text: 'Who would ride a motorcycle across the country?', tags: ['adventure'] },
  { id: '281', text: 'Who would rather stay far away from motorcycles?', tags: ['adventure'] },
  { id: '282', text: 'Who drives the fastest?', tags: ['adventure'] },
  { id: '283', text: 'Who drives like their grandparent?', tags: ['adventure'] },
  { id: '284', text: 'Who could start a fire with no matches?', tags: ['adventure'] },
  { id: '285', text: 'Who would be helpless without modern tools?', tags: ['adventure'] },
  { id: '286', text: 'Who could read a map without a phone?', tags: ['adventure'] },
  { id: '287', text: 'Who would get lost using GPS and a map?', tags: ['adventure'] },
  { id: '288', text: 'Who would miss a flight and stay completely calm?', tags: ['adventure'] },
  { id: '289', text: 'Who would have a meltdown missing a flight?', tags: ['adventure'] },
  { id: '290', text: 'Who could sleep anywhere?', tags: ['adventure'] },
  { id: '291', text: 'Who needs their exact pillow to sleep?', tags: ['adventure'] },
  { id: '292', text: 'Who would strike up a conversation with any stranger?', tags: ['adventure'] },
  { id: '293', text: 'Who would avoid eye contact with strangers entirely?', tags: ['adventure'] },
  { id: '294', text: 'Who would try the scariest ride at an amusement park?', tags: ['adventure'] },
  { id: '295', text: 'Who would sit out every ride?', tags: ['adventure'] },

  // Entertainment (more)
  { id: '296', text: 'Who gives the best show recommendations?', tags: ['entertainment'] },
  { id: '297', text: 'Who recommends shows nobody else likes?', tags: ['entertainment'] },
  { id: '298', text: 'Who spoils endings without meaning to?', tags: ['entertainment'] },
  { id: '299', text: 'Who avoids all spoilers at all costs?', tags: ['entertainment'] },
  { id: '300', text: 'Who rewatches the same show the most?', tags: ['entertainment'] },
  { id: '301', text: 'Who refuses to rewatch anything?', tags: ['entertainment'] },
  { id: '302', text: 'Who is obsessed with reality TV?', tags: ['entertainment'] },
  { id: '303', text: 'Who has never watched a reality show?', tags: ['entertainment'] },
  { id: '304', text: 'Who knows the most true crime cases?', tags: ['entertainment'] },
  { id: '305', text: 'Who gets too scared to watch true crime?', tags: ['entertainment'] },
  { id: '306', text: 'Who listens to the most podcasts?', tags: ['entertainment'] },
  { id: '307', text: 'Who has never finished an audiobook?', tags: ['entertainment'] },
  { id: '308', text: 'Who reads the most books?', tags: ['entertainment'] },
  { id: '309', text: 'Who hasn\'t finished a book in years?', tags: ['entertainment'] },
  { id: '310', text: 'Who knows the most about comic books?', tags: ['entertainment'] },
  { id: '311', text: 'Who is the biggest anime fan?', tags: ['entertainment'] },
  { id: '312', text: 'Who always wins board games?', tags: ['entertainment'] },
  { id: '313', text: 'Who flips the board when they lose?', tags: ['entertainment'] },
  { id: '314', text: 'Who would win a trivia night solo?', tags: ['entertainment'] },
  { id: '315', text: 'Who would be the weak link on a trivia team?', tags: ['entertainment'] },
  { id: '316', text: 'Who solves escape rooms the fastest?', tags: ['entertainment'] },
  { id: '317', text: 'Who gets stuck on the first puzzle?', tags: ['entertainment'] },
  { id: '318', text: 'Who has been to the most concerts?', tags: ['entertainment'] },
  { id: '319', text: 'Who has never been to a concert?', tags: ['entertainment'] },
  { id: '320', text: 'Who plays an instrument the best?', tags: ['entertainment'] },
  { id: '321', text: 'Who sings in the shower the loudest?', tags: ['entertainment'] },
  { id: '322', text: 'Who has taken dance lessons?', tags: ['entertainment'] },
  { id: '323', text: 'Who has two left feet on a dance floor?', tags: ['entertainment'] },
  { id: '324', text: 'Who would do the best in a stand-up comedy set?', tags: ['entertainment'] },
  { id: '325', text: 'Who would freeze on stage?', tags: ['entertainment'] },
  { id: '326', text: 'Who has the biggest celebrity crush?', tags: ['entertainment'] },
  { id: '327', text: 'Who follows celebrity gossip the closest?', tags: ['entertainment'] },
  { id: '328', text: 'Who cares the least about award shows?', tags: ['entertainment'] },
  { id: '329', text: 'Who is the most devoted sports fan?', tags: ['entertainment'] },
  { id: '330', text: 'Who couldn\'t name a single sports team?', tags: ['entertainment'] },
  { id: '331', text: 'Who takes fantasy leagues way too seriously?', tags: ['entertainment'] },
  { id: '332', text: 'Who is unbeatable at arcade games?', tags: ['entertainment'] },
  { id: '333', text: 'Who is still obsessed with retro video games?', tags: ['entertainment'] },
  { id: '334', text: 'Who has the most streaming subscriptions?', tags: ['entertainment'] },
  { id: '335', text: 'Who falls into YouTube rabbit holes the longest?', tags: ['entertainment'] },

  // Silly (more)
  { id: '336', text: 'Who spills their drink the most?', tags: ['silly'] },
  { id: '337', text: 'Who has walked into a closed door?', tags: ['silly'] },
  { id: '338', text: 'Who sneezes the loudest?', tags: ['silly'] },
  { id: '339', text: 'Who gets the hiccups at the worst times?', tags: ['silly'] },
  { id: '340', text: 'Who snorts when they laugh?', tags: ['silly'] },
  { id: '341', text: 'Who talks in their sleep?', tags: ['silly'] },
  { id: '342', text: 'Who has sleepwalked before?', tags: ['silly'] },
  { id: '343', text: 'Who drools when they nap?', tags: ['silly'] },
  { id: '344', text: 'Who gets stage fright doing completely normal things?', tags: ['silly'] },
  { id: '345', text: 'Who mispronounces the most words?', tags: ['silly'] },
  { id: '346', text: 'Who uses the wrong word constantly and doesn\'t notice?', tags: ['silly'] },
  { id: '347', text: 'Who has sent a text to the wrong person?', tags: ['silly'] },
  { id: '348', text: 'Who has the worst autocorrect fails?', tags: ['silly'] },
  { id: '349', text: 'Who has been caught talking to themselves?', tags: ['silly'] },
  { id: '350', text: 'Who sings the wrong lyrics with full confidence?', tags: ['silly'] },
  { id: '351', text: 'Who walks into a room and forgets why?', tags: ['silly'] },
  { id: '352', text: 'Who has looked for their phone while holding it?', tags: ['silly'] },
  { id: '353', text: 'Who has gotten lost in their own neighborhood?', tags: ['silly'] },
  { id: '354', text: 'Who has walked into a glass door?', tags: ['silly'] },
  { id: '355', text: 'Who has had food in their teeth for way too long without knowing?', tags: ['silly'] },
  { id: '356', text: 'Who has worn mismatched socks in public?', tags: ['silly'] },
  { id: '357', text: 'Who has worn a shirt inside out all day?', tags: ['silly'] },
  { id: '358', text: 'Who has been caught picking their nose?', tags: ['silly'] },
  { id: '359', text: 'Who waves back at someone who wasn\'t waving at them?', tags: ['silly'] },
  { id: '360', text: 'Who has hit reply-all by accident?', tags: ['silly'] },
  { id: '361', text: 'Who has sent a text to the wrong group chat?', tags: ['silly'] },
  { id: '362', text: 'Who trips over completely flat ground?', tags: ['silly'] },
  { id: '363', text: 'Who laughs at the worst possible moment?', tags: ['silly'] },
  { id: '364', text: 'Who cries at commercials?', tags: ['silly'] },
  { id: '365', text: 'Who has scared themselves in a mirror?', tags: ['silly'] },
  { id: '366', text: 'Who jumps at the smallest noise?', tags: ['silly'] },
  { id: '367', text: 'Who falls for pranks every single time?', tags: ['silly'] },
  { id: '368', text: 'Who believes obvious lies?', tags: ['silly'] },
  { id: '369', text: 'Who is the most gullible?', tags: ['silly'] },
  { id: '370', text: 'Who is the most superstitious?', tags: ['silly'] },
  { id: '371', text: 'Who seems to have the worst luck?', tags: ['silly'] },
  { id: '372', text: 'Who always loses at games?', tags: ['silly'] },
  { id: '373', text: 'Who is the biggest sore loser?', tags: ['silly'] },
  { id: '374', text: 'Who is the most obnoxious winner?', tags: ['silly'] },
  { id: '375', text: 'Who takes game night way too seriously?', tags: ['silly'] },

  // Random / Misc (more)
  { id: '376', text: 'Who would win the lottery and spend it all in a month?', tags: ['random'] },
  { id: '377', text: 'Who would invest their lottery winnings wisely?', tags: ['random'] },
  { id: '378', text: 'Who would start the most successful business?', tags: ['random'] },
  { id: '379', text: 'Who has the worst business ideas?', tags: ['random'] },
  { id: '380', text: 'Who would make the best president?', tags: ['random'] },
  { id: '381', text: 'Who would cause a national crisis in a week?', tags: ['random'] },
  { id: '382', text: 'Who would handle time travel the best?', tags: ['random'] },
  { id: '383', text: 'Who would accidentally change history?', tags: ['random'] },
  { id: '384', text: 'Who would survive longest on a deserted island?', tags: ['random'] },
  { id: '385', text: 'Who would be voted off the island first?', tags: ['random'] },
  { id: '386', text: 'Who would go viral by accident?', tags: ['random'] },
  { id: '387', text: 'Who would try the hardest to go viral and fail?', tags: ['random'] },
  { id: '388', text: 'Who would invent something genuinely useful?', tags: ['random'] },
  { id: '389', text: 'Who would invent something completely useless?', tags: ['random'] },
  { id: '390', text: 'Who would make the best superhero?', tags: ['random'] },
  { id: '391', text: 'Who would make the most useless superhero?', tags: ['random'] },
  { id: '392', text: 'Who would be the mastermind in a heist?', tags: ['random'] },
  { id: '393', text: 'Who would be the one to mess up the heist?', tags: ['random'] },
  { id: '394', text: 'Who would make the best spy?', tags: ['random'] },
  { id: '395', text: 'Who would blow their cover immediately?', tags: ['random'] },
  { id: '396', text: 'Who would win a reality TV competition?', tags: ['random'] },
  { id: '397', text: 'Who would be the first one eliminated?', tags: ['random'] },
  { id: '398', text: 'Who would handle sudden fame the best?', tags: ['random'] },
  { id: '399', text: 'Who would let fame go straight to their head?', tags: ['random'] },
  { id: '400', text: 'Who would retire the earliest?', tags: ['random'] },
  { id: '401', text: 'Who would work forever even with enough money?', tags: ['random'] },
  { id: '402', text: 'Who would survive best living off the grid?', tags: ['random'] },
  { id: '403', text: 'Who couldn\'t last a day without wifi and modern comforts?', tags: ['random'] },
  { id: '404', text: 'Who would make the best astronaut?', tags: ['random'] },
  { id: '405', text: 'Who would panic in zero gravity?', tags: ['random'] },
  { id: '406', text: 'Who would write a bestselling novel?', tags: ['random'] },
  { id: '407', text: 'Who has the most conspiracy theories?', tags: ['random'] },
  { id: '408', text: 'Who genuinely believes in aliens?', tags: ['random'] },
  { id: '409', text: 'Who has a hidden talent nobody knows about?', tags: ['random'] },
  { id: '410', text: 'Who is secretly the most talented cook, singer, or artist?', tags: ['random'] },

  // Food & Drink (new category)
  { id: '411', text: 'Who is the best cook in a real kitchen emergency?', tags: ['food'] },
  { id: '412', text: 'Who would burn water trying to boil pasta?', tags: ['food'] },
  { id: '413', text: 'Who can handle the spiciest food?', tags: ['food'] },
  { id: '414', text: 'Who taps out at the mildest hot sauce?', tags: ['food'] },
  { id: '415', text: 'Who always finds the best new restaurants?', tags: ['food'] },
  { id: '416', text: 'Who always picks the same restaurant every time?', tags: ['food'] },
  { id: '417', text: 'Who orders for the whole table?', tags: ['food'] },
  { id: '418', text: 'Who can never decide what to order?', tags: ['food'] },
  { id: '419', text: 'Who shares their food the most willingly?', tags: ['food'] },
  { id: '420', text: 'Who guards their plate like it\'s under attack?', tags: ['food'] },
  { id: '421', text: 'Who steals the most fries off other people\'s plates?', tags: ['food'] },
  { id: '422', text: 'Who never touches anyone else\'s food?', tags: ['food'] },
  { id: '423', text: 'Who has the most complicated coffee order?', tags: ['food'] },
  { id: '424', text: 'Who drinks their coffee completely plain?', tags: ['food'] },
  { id: '425', text: 'Who would pick dessert first every time?', tags: ['food'] },
  { id: '426', text: 'Who eats breakfast for dinner the most?', tags: ['food'] },
  { id: '427', text: 'Who has the weirdest food combinations?', tags: ['food'] },
  { id: '428', text: 'Who puts hot sauce on literally everything?', tags: ['food'] },
  { id: '429', text: 'Who avoids spicy food entirely?', tags: ['food'] },
  { id: '430', text: 'Who could win a cooking competition show?', tags: ['food'] },
  { id: '431', text: 'Who would set off the smoke alarm baking a cake?', tags: ['food'] },
  { id: '432', text: 'Who grills the best?', tags: ['food'] },
  { id: '433', text: 'Who snacks the most throughout the day?', tags: ['food'] },
  { id: '434', text: 'Who raids the fridge at midnight the most?', tags: ['food'] },
  { id: '435', text: 'Who orders delivery the most?', tags: ['food'] },
  { id: '436', text: 'Who refuses to order delivery on principle?', tags: ['food'] },
  { id: '437', text: 'Who tips the best?', tags: ['food'] },
  { id: '438', text: 'Who has the best buffet strategy?', tags: ['food'] },
  { id: '439', text: 'Who overloads their plate at a buffet?', tags: ['food'] },
  { id: '440', text: 'Who would do best at a fancy fine-dining restaurant?', tags: ['food'] },
  { id: '441', text: 'Who would feel most out of place at a fancy restaurant?', tags: ['food'] },
  { id: '442', text: 'Who knows the most about wine?', tags: ['food'] },
  { id: '443', text: 'Who can\'t tell one beer from another?', tags: ['food'] },
  { id: '444', text: 'Who makes the best cocktails?', tags: ['food'] },
  { id: '445', text: 'Who makes food look the most Instagram-worthy?', tags: ['food'] },
  { id: '446', text: 'Who eats leftovers without a second thought?', tags: ['food'] },
  { id: '447', text: 'Who won\'t eat anything a day past its date?', tags: ['food'] },
  { id: '448', text: 'Who has had the most kitchen disasters?', tags: ['food'] },
  { id: '449', text: 'Who owns way too many kitchen gadgets?', tags: ['food'] },
  { id: '450', text: 'Who has actually grown their own vegetables?', tags: ['food'] },
  { id: '451', text: 'Who would try foraging for wild food?', tags: ['food'] },
  { id: '452', text: 'Who would win a hot dog eating contest?', tags: ['food'] },
  { id: '453', text: 'Who is the best with chopsticks?', tags: ['food'] },
  { id: '454', text: 'Who eats the fastest?', tags: ['food'] },
  { id: '455', text: 'Who eats the slowest?', tags: ['food'] },

  // Sports & Fitness (new category)
  { id: '456', text: 'Who would win a pickup basketball game?', tags: ['sports'] },
  { id: '457', text: 'Who would be picked last for a pickup game?', tags: ['sports'] },
  { id: '458', text: 'Who has the best soccer skills?', tags: ['sports'] },
  { id: '459', text: 'Who has never made contact with a soccer ball on purpose?', tags: ['sports'] },
  { id: '460', text: 'Who would win at tennis?', tags: ['sports'] },
  { id: '461', text: 'Who would win at ping pong?', tags: ['sports'] },
  { id: '462', text: 'Who would win at pool or billiards?', tags: ['sports'] },
  { id: '463', text: 'Who has the steadiest hand at darts?', tags: ['sports'] },
  { id: '464', text: 'Who would win at bowling?', tags: ['sports'] },
  { id: '465', text: 'Who always throws a gutter ball?', tags: ['sports'] },
  { id: '466', text: 'Who lifts the heaviest weights?', tags: ['sports'] },
  { id: '467', text: 'Who avoids the gym entirely?', tags: ['sports'] },
  { id: '468', text: 'Who has the best yoga poses?', tags: ['sports'] },
  { id: '469', text: 'Who can\'t touch their toes?', tags: ['sports'] },
  { id: '470', text: 'Who has the most stamina?', tags: ['sports'] },
  { id: '471', text: 'Who gets winded the fastest?', tags: ['sports'] },
  { id: '472', text: 'Who is the fastest runner?', tags: ['sports'] },
  { id: '473', text: 'Who would finish a marathon?', tags: ['sports'] },
  { id: '474', text: 'Who wouldn\'t make it past mile one?', tags: ['sports'] },
  { id: '475', text: 'Who is the biggest couch potato?', tags: ['sports'] },
  { id: '476', text: 'Who has the best throwing arm?', tags: ['sports'] },
  { id: '477', text: 'Who can\'t catch anything thrown at them?', tags: ['sports'] },
  { id: '478', text: 'Who has the best hand-eye coordination?', tags: ['sports'] },
  { id: '479', text: 'Who is the clumsiest during sports?', tags: ['sports'] },
  { id: '480', text: 'Who always does a proper warm-up?', tags: ['sports'] },
  { id: '481', text: 'Who skips warm-ups and regrets it?', tags: ['sports'] },
  { id: '482', text: 'Who prefers working out at home?', tags: ['sports'] },
  { id: '483', text: 'Who prefers working out at the gym?', tags: ['sports'] },
  { id: '484', text: 'Who gives the best sideline commentary?', tags: ['sports'] },
  { id: '485', text: 'Who argues with referees the most?', tags: ['sports'] },
  { id: '486', text: 'Who celebrates the most dramatically after winning?', tags: ['sports'] },
  { id: '487', text: 'Who trash-talks the hardest during a game?', tags: ['sports'] },
  { id: '488', text: 'Who does the best cannonball into a pool?', tags: ['sports'] },
  { id: '489', text: 'Who does the best dive off a diving board?', tags: ['sports'] },
  { id: '490', text: 'Who is the best ice skater?', tags: ['sports'] },
  { id: '491', text: 'Who falls the most on ice skates?', tags: ['sports'] },
  { id: '492', text: 'Who is the best on roller skates?', tags: ['sports'] },
  { id: '493', text: 'Who would pick up skiing the fastest?', tags: ['sports'] },
  { id: '494', text: 'Who would spend the whole ski trip in the lodge?', tags: ['sports'] },
  { id: '495', text: 'Who has done martial arts?', tags: ['sports'] },
  { id: '496', text: 'Who would last longest in a boxing match?', tags: ['sports'] },
  { id: '497', text: 'Who has the best frisbee throw?', tags: ['sports'] },
  { id: '498', text: 'Who is unbeatable at cornhole?', tags: ['sports'] },
  { id: '499', text: 'Who gets way too competitive at backyard games?', tags: ['sports'] },
  { id: '500', text: 'Who just wants everyone to have fun, no score needed?', tags: ['sports'] },
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