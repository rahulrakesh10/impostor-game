// frontend/src/SoundToggle.tsx — mute/unmute control for sound effects, shared by host and player
import React, { useState } from 'react';
import { soundManager } from './sounds';

export function SoundToggle() {
  const [enabled, setEnabled] = useState(soundManager.isEnabled());

  return (
    <button
      className="link-button"
      onClick={() => {
        soundManager.toggle();
        setEnabled(soundManager.isEnabled());
      }}
      title={enabled ? 'Disable sounds' : 'Enable sounds'}
      type="button"
    >
      {enabled ? 'Sound: On' : 'Sound: Off'}
    </button>
  );
}
