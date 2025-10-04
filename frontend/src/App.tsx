// frontend/src/App.tsx
import React, { useState, useEffect } from 'react';
import HostApp from './HostApp';
import PlayerApp from './PlayerApp';

function App() {
  const [isHostScreen, setIsHostScreen] = useState<boolean>(false);
  const [showModeSelector, setShowModeSelector] = useState<boolean>(true);

  // Screen size detection for host vs player screens
  useEffect(() => {
    const checkScreenSize = () => {
      const isLargeScreen = window.innerWidth >= 768; // Tablet/laptop size
      // Default to host screen for large screens, but allow manual override
      if (isLargeScreen && !localStorage.getItem('userModePreference')) {
        setIsHostScreen(true);
      }
      console.log('Screen size check:', window.innerWidth, 'isHostScreen:', isLargeScreen);
    };
    
    // Check for saved preference
    const savedMode = localStorage.getItem('userModePreference');
    if (savedMode) {
      setIsHostScreen(savedMode === 'host');
      setShowModeSelector(false);
    } else {
      checkScreenSize();
    }
    
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleModeSelect = (mode: 'host' | 'player') => {
    setIsHostScreen(mode === 'host');
    setShowModeSelector(false);
    localStorage.setItem('userModePreference', mode);
  };

  const handleSwitchMode = () => {
    const nextMode = isHostScreen ? 'player' : 'host';
    setIsHostScreen(nextMode === 'host');
    setShowModeSelector(false);
    localStorage.setItem('userModePreference', nextMode);
  };

  // Show mode selector if user hasn't chosen yet
  if (showModeSelector) {
  return (
    <div className="screen">
      <div className="container">
        <h1 className="title">Fake Out</h1>
        
          <div className="mode-selector-screen">
            <h2>Choose Your Role</h2>
            <p>Select how you want to play:</p>
            
            <div className="mode-buttons">
          <button 
                className="button primary host-mode-btn"
                onClick={() => handleModeSelect('host')}
              >
                🖥️ Host Game
                <small>Manage the game on iPad/Laptop</small>
            </button>
        
        <button 
                className="button primary player-mode-btn"
                onClick={() => handleModeSelect('player')}
        >
                📱 Join Game
                <small>Play on your phone</small>
        </button>
      </div>
        </div>
      </div>
    </div>
  );
}

  // Render appropriate app based on selected mode
  if (isHostScreen) {
  return (
      <div>
        <button 
          className="mode-toggle-btn"
          onClick={handleSwitchMode}
          title="Switch to Player Mode"
        >
          📱 Switch to Player
        </button>
        <HostApp />
    </div>
  );
  } else {
  return (
      <div>
        <button 
          className="mode-toggle-btn"
          onClick={handleSwitchMode}
          title="Switch to Host Mode"
        >
          🖥️ Switch to Host
        </button>
        <PlayerApp />
    </div>
  );
  }
}

export default App;