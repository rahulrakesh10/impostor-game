// frontend/src/HowToPlay.tsx — shared case-briefing carousel for host and player screens
import React, { useState } from 'react';

interface Slide {
  eyebrow: string;
  title: string;
  description: string;
  visual: React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    eyebrow: 'Page 1 of 5',
    title: 'The Setup',
    description: 'One investigator runs the board from a larger screen. Everyone else joins from their phone.',
    visual: (
      <div className="brief-row">
        <div className="brief-box">Host — larger screen</div>
        <div className="brief-box">Suspects — phones</div>
      </div>
    ),
  },
  {
    eyebrow: 'Page 2 of 5',
    title: 'Open the Case',
    description: "Share the case number or let suspects scan the host's QR code to join instantly.",
    visual: (
      <div className="brief-row">
        <div className="brief-box brief-box-pin">1 2 3 4 5 6</div>
        <div className="brief-box">QR scan</div>
      </div>
    ),
  },
  {
    eyebrow: 'Page 3 of 5',
    title: 'The Statement',
    description: 'Most suspects see the same question. One gets a close cousin of it — without knowing they\'re the outlier.',
    visual: (
      <div className="brief-row">
        <div className="brief-box">"Who is the funniest?"</div>
        <div className="brief-box brief-box-flag">"Who is the most serious?"</div>
      </div>
    ),
  },
  {
    eyebrow: 'Page 4 of 5',
    title: 'Cross-Examination',
    description: 'Compare answers out loud. Listen for the story that doesn\'t quite fit everyone else\'s.',
    visual: (
      <div className="brief-row">
        <div className="brief-box">Alice → Bob</div>
        <div className="brief-box">Carol → Bob</div>
        <div className="brief-box brief-box-flag">Bob → Alice</div>
      </div>
    ),
  },
  {
    eyebrow: 'Page 5 of 5',
    title: 'The Verdict',
    description: 'Vote for who you think is the impostor. Catch them and everyone else scores a point. Miss, and the impostor scores three.',
    visual: (
      <div className="brief-row">
        <div className="brief-box">Caught → group +1 each</div>
        <div className="brief-box brief-box-flag">Escaped → impostor +3</div>
      </div>
    ),
  },
];

export function HowToPlayButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="link-button" onClick={onClick} type="button">
      How to Play
    </button>
  );
}

export function HowToPlayModal({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <div className="briefing-overlay" onClick={onClose}>
      <div className="briefing" onClick={(e) => e.stopPropagation()}>
        <div className="case-tag">{slide.eyebrow}</div>
        <h2>{slide.title}</h2>
        <p className="briefing-description">{slide.description}</p>

        {slide.visual}

        <div className="briefing-dots">
          {SLIDES.map((_, i) => (
            <span key={i} className={`briefing-dot ${i === index ? 'active' : ''}`} />
          ))}
        </div>

        <div className="briefing-nav">
          <button
            className="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            type="button"
          >
            Back
          </button>
          {isLast ? (
            <button className="button primary" onClick={onClose} type="button">
              Got It
            </button>
          ) : (
            <button
              className="button primary"
              onClick={() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1))}
              type="button"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
