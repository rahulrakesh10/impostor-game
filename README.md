# 🎭 Fake Out Game

A real-time multiplayer party game where players try to identify the fake among them! Built with React, TypeScript, Node.js, and Socket.IO.

## 🎮 Game Overview

**Fake Out** is a social deduction game where:
- One player is secretly the "fake" with a different question
- Other players work together to identify the fake
- Players vote on who they think is the fake
- Points are awarded based on correct guesses

## ✨ Features

### 🎯 Core Gameplay
- **Real-time multiplayer** with Socket.IO
- **Host/Player separation** - Host manages the game, players participate
- **Multiple rounds** with customizable settings
- **Live voting system** with real-time results
- **Score tracking** and leaderboard

### 🎨 Visual Design
- **Multiple themes**: Default, Dark, Neon, and Pastel
- **Mobile-friendly** responsive design
- **Animated timers** with color-coded phases
- **Beautiful gradients** and modern UI
- **Player name display** in corner

### ⚙️ Customizable Settings
- **Timer controls**: Answer time, discussion time, voting time
- **Round management**: Number of rounds
- **Scoring system**: Points for fake and group
- **Display options**: Show player names, allow spectators
- **Theme selection**: Real-time theme switching

### 📱 Device Support
- **Host Screen**: Optimized for tablets/laptops
- **Player Screen**: Mobile-friendly for phones
- **Mode switching**: Easy toggle between host and player modes

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/rahulrakesh10/fake-out-game.git
   cd fake-out-game
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Game

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```
   Server runs on `http://localhost:3001`

2. **Start the frontend**
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend runs on `http://localhost:5173`

3. **Open your browser**
   - Go to `http://localhost:5173`
   - Choose "Host Game" for the game master
   - Choose "Join Game" for players

## 🎮 How to Play

### For Hosts
1. **Start a Game**: Click "Host Game" and create a room
2. **Share PIN**: Give the room PIN to players
3. **Configure Settings**: Adjust timers, rounds, and themes
4. **Manage Game**: Start rounds and monitor progress
5. **View Results**: See scores and leaderboard

### For Players
1. **Join Game**: Click "Join Game" and enter the room PIN
2. **Enter Name**: Choose your display name
3. **Answer Questions**: Select your answer during the answering phase
4. **Discuss**: Talk with other players during discussion time
5. **Vote**: Vote for who you think is the fake
6. **See Results**: View scores and game progression

## 🎯 Game Phases

### 1. **Answering Phase** (30 seconds default)
- All players answer their question
- Fake gets a different question (unknown to them)
- Host can see all answers in real-time

### 2. **Discussion Phase** (120 seconds default)
- Players discuss their answers
- Try to identify inconsistencies
- Host can see discussion progress

### 3. **Voting Phase** (15 seconds default)
- Players vote for who they think is the fake
- Real-time vote counting
- Results revealed immediately

### 4. **Results Phase**
- Show who was the fake
- Display scores and leaderboard
- Move to next round or end game

## ⚙️ Configuration

### Game Settings
- **Answer Timer**: 15-60 seconds
- **Discussion Timer**: 30-300 seconds  
- **Vote Timer**: 5-30 seconds
- **Rounds**: 1-10 rounds
- **Fake Points**: 1-10 points
- **Group Points**: 1-5 points

### Themes
- **Default**: Bright and colorful
- **Dark**: Dark mode with purple accents
- **Neon**: Cyberpunk style with green/pink
- **Pastel**: Soft and gentle colors

## 🛠️ Technical Details

### Backend (Node.js + TypeScript)
- **Express.js** server with Socket.IO
- **Real-time communication** between host and players
- **Game state management** with room-based architecture
- **Timer synchronization** across all clients
- **Theme broadcasting** system

### Frontend (React + TypeScript)
- **React 18** with TypeScript
- **Vite** for fast development
- **Socket.IO Client** for real-time updates
- **Responsive CSS** with CSS variables
- **Local storage** for user preferences

### Key Components
- `HostApp.tsx` - Host interface and game management
- `PlayerApp.tsx` - Player interface and gameplay
- `App.tsx` - Mode selection and routing
- `server.ts` - Backend game logic and Socket.IO handlers

## 📁 Project Structure

```
fake-out-game/
├── backend/
│   ├── src/
│   │   └── server.ts          # Main server file
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Main app component
│   │   ├── HostApp.tsx        # Host interface
│   │   ├── PlayerApp.tsx      # Player interface
│   │   ├── index.css          # Global styles and themes
│   │   └── main.tsx           # App entry point
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## 🎨 Customization

### Adding New Themes
1. Add CSS variables to `frontend/src/index.css`
2. Create new `[data-theme="your-theme"]` section
3. Update theme options in `HostApp.tsx`

### Modifying Game Logic
- **Backend**: Edit `backend/src/server.ts`
- **Frontend**: Modify `HostApp.tsx` and `PlayerApp.tsx`
- **Styling**: Update `frontend/src/index.css`

## 🐛 Troubleshooting

### Common Issues

**Port already in use**
```bash
# Kill processes using ports 3001 or 5173
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

**Dependencies not found**
```bash
# Reinstall dependencies
cd backend && rm -rf node_modules && npm install
cd ../frontend && rm -rf node_modules && npm install
```

**Socket connection issues**
- Check that backend is running on port 3001
- Verify CORS settings in `server.ts`
- Ensure firewall allows local connections

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with React, TypeScript, Node.js, and Socket.IO
- Inspired by social deduction games like Among Us
- UI design inspired by modern party games like Kahoot

## 📞 Support

If you encounter any issues or have questions:
- Open an issue on GitHub
- Check the troubleshooting section above
- Review the game settings and configuration

---

**Have fun playing Fake Out! 🎉**
