export interface Player {
  id: string;
  displayName: string;
  status: 'connected' | 'disconnected';
}

export type GamePhase =
  | 'landing'
  | 'lobby'
  | 'answering'
  | 'discussing'
  | 'voting'
  | 'results'
  | 'ended';

export interface GameState {
  state: GamePhase;
  room?: { pin: string; players: Player[] };
  user?: { id: string; displayName: string; isHost: boolean };
  currentQuestion?: string;
  isFake?: boolean;
  timer?: number;
  scores?: Array<{ userId: string; displayName: string; score: number }>;
  lastResult?: {
    fakeId: string;
    fakeCaught: boolean;
    fakeQuestion?: string;
  };
}
