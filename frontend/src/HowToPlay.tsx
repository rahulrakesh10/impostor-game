// frontend/src/HowToPlay.tsx — shared case-briefing modal for host and player screens
import React from 'react';

const STEPS = [
  "One of you is secretly the impostor each round. Everyone else gets the same question — the impostor gets a close cousin of it, without knowing they're the odd one out.",
  "Everyone submits a statement: pick the suspect who best fits your question.",
  "Compare statements out loud. The impostor's answer won't quite line up with everyone else's.",
  "Cast your accusation — vote for whoever you think is the impostor.",
  "If the group catches the impostor, everyone else scores a point. If the impostor slips away, they score three.",
];

export function HowToPlayButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="link-button" onClick={onClick} type="button">
      How to Play
    </button>
  );
}

export function HowToPlayModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="briefing-overlay" onClick={onClose}>
      <div className="briefing" onClick={(e) => e.stopPropagation()}>
        <div className="case-tag">The Brief</div>
        <h2>How to Play</h2>
        <ol>
          {STEPS.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <button className="button primary close-button" onClick={onClose} type="button">
          Got It
        </button>
      </div>
    </div>
  );
}
