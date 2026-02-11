# 🎭 Fake Out Game

A real-time multiplayer party game where players try to identify the impostor among them! Built with React 19, TypeScript, Node.js, and Socket.IO. Deployed on Fly.io with Docker containerization.
Play the game right now: https://fakeout.fly.dev/

## 🎮 Game Overview

**Fake Out** is a social deduction game where:
- One player is secretly the "fake" with a different question
- Other players work together to identify the fake
- Players vote on who they think is the fake
- Points are awarded based on correct guesses
- Multiple rounds with customizable settings and themes

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

### 📲 Mobile app (Expo)
- **Players** use the Expo app: run `npx expo start` in the `mobile` folder and scan the QR code with Expo Go.
- For local dev on a physical device, set EXPO_PUBLIC_SOCKET_URL to your machine IP (e.g. http://192.168.1.5:3001) in mobile/src/config.ts or via env.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher) - required for backend
- npm or yarn
- Docker (optional, for containerized deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/rahulrakesh10/impostor-game.git
   cd impostor-game
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install web frontend (host)**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Install mobile app (players)**
   ```bash
   cd ../mobile
   npm install
   ```

### Running the Game

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```
   Server runs on `http://localhost:3001`

2. **Start the host (web)**
   ```bash
   cd frontend
   npm run dev
   ```
   Open `http://localhost:5173` in a browser and choose **Host Game**. Share the room PIN with players.

3. **Run the player app (mobile)**
   ```bash
   cd mobile
   npx expo start
   ```
   Scan the QR code with Expo Go (Android) or the Camera app (iOS). In the app, enter the room PIN and your name to join.
   - **On a physical device**: To use your local backend, set the backend URL to your machine’s IP (e.g. `http://192.168.1.5:3001`) via environment variable `EXPO_PUBLIC_SOCKET_URL` or change `mobile/src/config.ts`.

## 🚀 Deployment

### Docker Deployment

The application is containerized using Docker with a multi-stage build:

1. **Build the Docker image**
   ```bash
   docker build -t fake-out-game .
   ```

2. **Run the container**
   ```bash
   docker run -p 80:80 fake-out-game
   ```

3. **Access the application**
   - Go to `http://localhost`
   - The app will be served with nginx on port 80

### Fly.io Deployment

The application is deployed on Fly.io for production:

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Deploy to Fly.io**
   ```bash
   fly deploy
   ```

3. **Access the live application**
   - Visit: `https://fakeout.fly.dev`
   - The app runs on Fly.io's global network

### Production Architecture

- **Frontend**: Built with Vite and served by nginx
- **Backend**: Node.js Express server with Socket.IO
- **Container**: Alpine Linux with multi-stage Docker build
- **Proxy**: nginx handles routing and WebSocket proxying
- **Platform**: Fly.io with auto-scaling and HTTPS

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
- **Express.js** server with Socket.IO v4.7.5
- **Real-time communication** between host and players
- **Game state management** with room-based architecture
- **Timer synchronization** across all clients
- **Theme broadcasting** system
- **CORS support** for cross-origin requests
- **UUID generation** for unique room and player IDs

### Frontend (React + TypeScript)
- **React 19** with TypeScript
- **Vite 7.1.6** for fast development and building
- **Socket.IO Client v4.8.1** for real-time updates
- **Responsive CSS** with CSS variables and themes
- **Local storage** for user preferences
- **ESLint** for code quality
- **Modern React patterns** with hooks and functional components

## 📁 Project Structure

```
impostor-game/
├── backend/
│   ├── src/
│   │   └── server.ts          # Main server file with game logic
│   ├── dist/                  # Compiled JavaScript output
│   ├── package.json           # Backend dependencies
│   └── tsconfig.json          # TypeScript configuration
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Main app component with mode selection
│   │   ├── HostApp.tsx        # Host interface and game management
│   │   ├── PlayerApp.tsx      # Player interface and gameplay
│   │   ├── index.css          # Global styles and theme variables
│   │   └── main.tsx           # React app entry point
│   ├── dist/                  # Built frontend assets
│   ├── public/                # Static assets
│   ├── package.json           # Frontend dependencies
│   ├── vite.config.ts         # Vite build configuration
│   └── eslint.config.js       # ESLint configuration
├── Dockerfile                 # Multi-stage Docker build
├── fly.toml                   # Fly.io deployment configuration
├── nginx.conf                 # Nginx configuration for production
├── start.sh                   # Production startup script
└── README.md                  # Project documentation
```

## 🌐 Live Demo

Try the game online at: **https://fakeout.fly.dev**


---

