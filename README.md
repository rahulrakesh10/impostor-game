# Impostor Game

A real-time multiplayer impostor game with host/player screens, built with React, TypeScript, and Socket.IO.

## Features

- �� **Host/Player Screens**: Automatic detection based on screen size
- 🎯 **Real-time Multiplayer**: Socket.IO for instant communication
- 🎨 **Beautiful UI**: Animated gradients and modern design
- 📱 **Kahoot-style Joining**: Easy room PIN system
- ⏱️ **Timed Rounds**: Answering (30s), Discussion (120s), Voting (15s)
- 🏆 **Leaderboard**: Track scores across rounds

## How to Play

1. **Host**: Open on iPad/laptop → Click "Start a Game" → Share PIN
2. **Players**: Open on phones → Enter name + PIN → Join Game
3. **Game Flow**: Answer → Discuss → Vote → Results → Repeat

## Setup

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Backend**: Node.js, Express, Socket.IO
- **Styling**: CSS with animations and gradients
- **Real-time**: WebSocket communication
