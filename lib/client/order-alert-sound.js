let audioCtx = null;
let isUnlocked = false;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

/**
 * Unlocks audio context on user interaction to comply with browser autoplay restrictions.
 */
export function unlockAudioContext() {
  if (isUnlocked || typeof window === "undefined") return;

  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().then(() => {
      isUnlocked = true;
    }).catch(() => {});
  } else if (ctx && ctx.state === "running") {
    isUnlocked = true;
  }
}

// Auto-register unlock on first user interaction
if (typeof window !== "undefined") {
  const unlockEvents = ["click", "touchstart", "keydown"];
  const handleFirstInteraction = () => {
    unlockAudioContext();
    unlockEvents.forEach((ev) => window.removeEventListener(ev, handleFirstInteraction));
  };

  unlockEvents.forEach((ev) =>
    window.addEventListener(ev, handleFirstInteraction, { passive: true, once: true })
  );
}

/**
 * Plays a pleasant 3-tone chime for new order alerts using Web Audio API synthesis.
 */
export function playOrderAlertSound() {
  if (typeof window === "undefined") return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().then(() => playChime(ctx)).catch(() => {});
    } else {
      playChime(ctx);
    }
  } catch (e) {
    console.warn("[Sound] Could not play alert chime:", e);
  }
}

function playChime(ctx) {
  const now = ctx.currentTime;

  // Notes: G5 (783.99 Hz), C6 (1046.50 Hz), E6 (1318.51 Hz)
  const notes = [
    { freq: 783.99, start: 0, duration: 0.28 },
    { freq: 1046.50, start: 0.12, duration: 0.32 },
    { freq: 1318.51, start: 0.24, duration: 0.45 },
  ];

  notes.forEach(({ freq, start, duration }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + start);

    // Subtle harmonic overtone for warmth
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.22, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + start);
    osc.stop(now + start + duration);
  });
}
