// frontend/src/App.tsx
import React, { useState, useEffect } from 'react';
import HostApp from './HostApp';
import PlayerApp from './PlayerApp';

type ViewMode = 'auto' | 'host' | 'player';

const VIEW_KEY = 'impostor_view_override';

function App() {
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(window.innerWidth >= 768);
  const [override, setOverride] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_KEY) as ViewMode) || 'auto'
  );

  // Screen size detection for host vs player screens
  useEffect(() => {
    const checkScreenSize = () => setIsLargeScreen(window.innerWidth >= 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const setView = (mode: ViewMode) => {
    setOverride(mode);
    if (mode === 'auto') {
      localStorage.removeItem(VIEW_KEY);
    } else {
      localStorage.setItem(VIEW_KEY, mode);
    }
  };

  const isHostScreen = override === 'auto' ? isLargeScreen : override === 'host';

  return (
    <>
      <button
        className="view-toggle"
        onClick={() => setView(isHostScreen ? 'player' : 'host')}
        title="Override automatic screen detection"
      >
        Switch to {isHostScreen ? 'Player' : 'Host'} view
      </button>
      {isHostScreen ? <HostApp /> : <PlayerApp />}
    </>
  );
}

export default App;
