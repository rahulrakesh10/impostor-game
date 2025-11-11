// Sound effects using Web Audio API (no external files needed)

class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;
  private lastPlayedTimer: number = 0; // Track last timer value that played sound

  constructor() {
    // Initialize audio context on first user interaction (browser requirement)
    this.initializeAudioContext();
    
    // Load sound preference from localStorage
    const savedPreference = localStorage.getItem('soundEnabled');
    if (savedPreference !== null) {
      this.enabled = savedPreference === 'true';
    }
  }

  private initializeAudioContext() {
    try {
      // Create audio context - will be resumed on user interaction
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
      this.enabled = false;
    }
  }

  // Resume audio context (required after user interaction)
  async resumeContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  // Generate a beep sound
  private beep(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
    if (!this.enabled || !this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (e) {
      console.warn('Error playing sound:', e);
    }
  }

  // Timer warning sound (last 3 seconds - urgent beeps)
  playTimerWarning(timerValue?: number) {
    // Only play once per timer value to avoid duplicates
    if (timerValue !== undefined && timerValue === this.lastPlayedTimer) {
      return;
    }
    if (timerValue !== undefined) {
      this.lastPlayedTimer = timerValue;
    }
    this.beep(800, 0.1, 'sine', 0.3);
  }

  // Timer critical sound (last second - very urgent)
  playTimerCritical(timerValue?: number) {
    // Only play once per timer value to avoid duplicates
    if (timerValue !== undefined && timerValue === this.lastPlayedTimer) {
      return;
    }
    if (timerValue !== undefined) {
      this.lastPlayedTimer = timerValue;
    }
    this.beep(1000, 0.15, 'square', 0.4);
  }

  // Reset timer sound tracking (call when timer resets)
  resetTimerSoundTracking() {
    this.lastPlayedTimer = 0;
  }

  // Button click sound
  playClick() {
    this.beep(600, 0.05, 'sine', 0.2);
  }

  // Success sound
  playSuccess() {
    // Two-tone ascending sound
    this.beep(523, 0.1, 'sine', 0.3); // C
    setTimeout(() => {
      this.beep(659, 0.1, 'sine', 0.3); // E
    }, 100);
    setTimeout(() => {
      this.beep(784, 0.2, 'sine', 0.3); // G
    }, 200);
  }

  // Failure sound
  playFailure() {
    // Descending sound
    this.beep(400, 0.2, 'sawtooth', 0.3);
  }

  // Round start sound
  playRoundStart() {
    // Upward sweep
    this.beep(400, 0.3, 'sine', 0.3);
    setTimeout(() => {
      this.beep(600, 0.2, 'sine', 0.3);
    }, 150);
  }

  // Vote/submit sound
  playSubmit() {
    this.beep(700, 0.1, 'sine', 0.25);
  }

  // Enable/disable sounds
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem('soundEnabled', enabled.toString());
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Toggle sounds on/off
  toggle() {
    this.setEnabled(!this.enabled);
  }
}

// Export singleton instance
export const soundManager = new SoundManager();

// Resume audio context on any user interaction
if (typeof window !== 'undefined') {
  const resumeAudio = () => {
    soundManager.resumeContext();
    // Remove listeners after first interaction
    document.removeEventListener('click', resumeAudio);
    document.removeEventListener('touchstart', resumeAudio);
    document.removeEventListener('keydown', resumeAudio);
  };

  document.addEventListener('click', resumeAudio, { once: true });
  document.addEventListener('touchstart', resumeAudio, { once: true });
  document.addEventListener('keydown', resumeAudio, { once: true });
}

