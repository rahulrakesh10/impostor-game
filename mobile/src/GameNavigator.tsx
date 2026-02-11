import React from 'react';
import { useGame } from './context/GameContext';
import { JoinScreen } from './screens/JoinScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { AnswerScreen } from './screens/AnswerScreen';
import { AnswerConfirmationScreen } from './screens/AnswerConfirmationScreen';
import { DiscussionScreen } from './screens/DiscussionScreen';
import { VotingScreen } from './screens/VotingScreen';
import { VoteConfirmationScreen } from './screens/VoteConfirmationScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { GameEndScreen } from './screens/GameEndScreen';

export function GameNavigator() {
  const { gameState, answerSubmitted, voteSubmitted } = useGame();
  const { state } = gameState;

  if (state === 'landing') return <JoinScreen />;
  if (state === 'lobby') return <LobbyScreen />;
  if (state === 'answering') {
    return answerSubmitted ? <AnswerConfirmationScreen /> : <AnswerScreen />;
  }
  if (state === 'discussing') return <DiscussionScreen />;
  if (state === 'voting') {
    return voteSubmitted ? <VoteConfirmationScreen /> : <VotingScreen />;
  }
  if (state === 'results') return <ResultsScreen />;
  if (state === 'ended') return <GameEndScreen />;

  return <JoinScreen />;
}
