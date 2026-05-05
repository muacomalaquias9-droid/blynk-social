// Programmatic sound generation - no external files needed

const audioCtx = () => new (window.AudioContext || (window as any).webkitAudioContext)();

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  try {
    const ctx = audioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    return ctx;
  } catch { return null; }
}

// Calling ringtone - repeating dual tone (like phone ringing)
let callingInterval: ReturnType<typeof setInterval> | null = null;
export function startCallingSound() {
  stopCallingSound();
  const ring = () => {
    playTone(440, 0.9, 'sine', 0.18);
    setTimeout(() => playTone(480, 0.9, 'sine', 0.14), 80);
    setTimeout(() => playTone(440, 0.9, 'sine', 0.12), 140);
  };
  ring();
  callingInterval = setInterval(ring, 3100);
}

export function stopCallingSound() {
  if (callingInterval) {
    clearInterval(callingInterval);
    callingInterval = null;
  }
}

// Ringing sound - incoming call (more urgent pattern)
let ringingInterval: ReturnType<typeof setInterval> | null = null;
export function startRingingSound() {
  stopRingingSound();
  const ring = () => {
    playTone(1318, 0.18, 'sine', 0.22);
    setTimeout(() => playTone(1568, 0.18, 'sine', 0.2), 220);
    setTimeout(() => playTone(1175, 0.18, 'sine', 0.18), 440);
    setTimeout(() => playTone(1568, 0.32, 'sine', 0.2), 660);
  };
  ring();
  ringingInterval = setInterval(ring, 2200);
}

export function stopRingingSound() {
  if (ringingInterval) {
    clearInterval(ringingInterval);
    ringingInterval = null;
  }
}

// Connect sound - single pleasant chime
export function playConnectSound() {
  playTone(523, 0.15, 'sine', 0.3);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.3), 100);
  setTimeout(() => playTone(784, 0.3, 'sine', 0.3), 200);
}

// Hangup sound - descending tone
export function playHangupSound() {
  playTone(440, 0.2, 'sine', 0.3);
  setTimeout(() => playTone(330, 0.3, 'sine', 0.25), 150);
}
