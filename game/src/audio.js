// Sound, synthesized with WebAudio — no audio files. A tiny step sequencer plays a
// cheerful original folk tune on a triangle wave with a soft bass, and short synthesized
// effects answer every action: a jump, a corn chime, a hit squawk, the farmer's alert,
// a dash whoosh, and the caught and escaped jingles. Everything starts on the first
// user gesture, since a browser will not play before one, and M (or the mute call)
// silences it all.

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** An original jaunty tune in C major, looped: melody on top, bass below. */
const MELODY = [
  76, 79, 81, 79, 76, 74, 72, 74,
  76, 79, 81, 84, 81, 79, 76, 74,
  72, 74, 76, 79, 81, 79, 76, 72,
  74, 76, 74, 72, 74, 72, 74, 76,
];
const BASS = [48, 55, 57, 53, 48, 55, 48, 55];
/** Eighth notes at 132 beats a minute. */
const STEP_SECONDS = 60 / 132 / 2;

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let nextStep = 0;
  let stepIndex = 0;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (context !== null && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, start, duration, type, volume, slideTo) {
    if (!ensure()) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function noise(start, duration, volume, fromFreq, toFreq) {
    if (!ensure()) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(fromFreq, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, toFreq), start + duration);
    filter.Q.value = 1.2;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + duration + 0.05);
  }

  function scheduleStep(index, when) {
    const melodyNote = MELODY[index % MELODY.length];
    const bassNote = BASS[Math.floor(index / 4) % BASS.length];
    // The melody, a triangle wave; the bass, a soft sine an octave down, on the beat.
    const mel = context.createOscillator();
    const melGain = context.createGain();
    mel.type = 'triangle';
    mel.frequency.value = midiToFreq(melodyNote);
    melGain.gain.setValueAtTime(0, when);
    melGain.gain.linearRampToValueAtTime(0.5, when + 0.02);
    melGain.gain.exponentialRampToValueAtTime(0.001, when + STEP_SECONDS * 0.95);
    mel.connect(melGain);
    melGain.connect(musicGain);
    mel.start(when);
    mel.stop(when + STEP_SECONDS);
    if (index % 2 === 0) {
      const bass = context.createOscillator();
      const bassGain = context.createGain();
      bass.type = 'sine';
      bass.frequency.value = midiToFreq(bassNote);
      bassGain.gain.setValueAtTime(0, when);
      bassGain.gain.linearRampToValueAtTime(0.4, when + 0.02);
      bassGain.gain.exponentialRampToValueAtTime(0.001, when + STEP_SECONDS * 1.8);
      bass.connect(bassGain);
      bassGain.connect(musicGain);
      bass.start(when);
      bass.stop(when + STEP_SECONDS * 2);
    }
  }

  function startMusic() {
    if (!ensure() || musicTimer !== null) return;
    resume();
    nextStep = context.currentTime + 0.06;
    stepIndex = 0;
    musicTimer = window.setInterval(() => {
      if (context === null) return;
      while (nextStep < context.currentTime + 0.12) {
        scheduleStep(stepIndex, nextStep);
        nextStep += STEP_SECONDS;
        stepIndex += 1;
      }
    }, 30);
  }

  function stopMusic() {
    if (musicTimer !== null) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function now() {
    return context === null ? 0 : context.currentTime;
  }

  return {
    get muted() {
      return muted;
    },
    unlock() {
      if (ensure()) resume();
    },
    toggleMute() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    jump() {
      if (!ensure()) return;
      const t = now();
      tone(midiToFreq(72), t, 0.16, 'sine', 0.35, midiToFreq(84));
    },
    corn(golden) {
      if (!ensure()) return;
      const t = now();
      tone(midiToFreq(88), t, 0.12, 'sine', 0.3);
      tone(midiToFreq(93), t + 0.07, 0.16, 'sine', 0.3);
      if (golden) tone(midiToFreq(100), t + 0.14, 0.2, 'sine', 0.3);
    },
    hit() {
      if (!ensure()) return;
      const t = now();
      // A low thud and a squawk: a quick descending warble, the turkey's gobble.
      tone(140, t, 0.18, 'sine', 0.5, 60);
      tone(midiToFreq(82), t + 0.02, 0.1, 'sawtooth', 0.18, midiToFreq(70));
      tone(midiToFreq(79), t + 0.12, 0.1, 'sawtooth', 0.18, midiToFreq(67));
    },
    spot() {
      if (!ensure()) return;
      const t = now();
      tone(midiToFreq(94), t, 0.09, 'square', 0.16);
      tone(midiToFreq(94), t + 0.12, 0.09, 'square', 0.16);
    },
    hide() {
      if (!ensure()) return;
      noise(now(), 0.25, 0.12, 1200, 300);
    },
    dash() {
      if (!ensure()) return;
      noise(now(), 0.22, 0.2, 400, 2400);
    },
    nearMiss() {
      if (!ensure()) return;
      noise(now(), 0.12, 0.12, 2000, 500);
    },
    caught() {
      if (!ensure()) return;
      const t = now();
      tone(midiToFreq(72), t, 0.28, 'sawtooth', 0.22, midiToFreq(67));
      tone(midiToFreq(67), t + 0.26, 0.28, 'sawtooth', 0.22, midiToFreq(62));
      tone(midiToFreq(62), t + 0.52, 0.55, 'sawtooth', 0.22, midiToFreq(55));
    },
    escaped() {
      if (!ensure()) return;
      const t = now();
      const notes = [72, 76, 79, 84, 79, 84];
      notes.forEach((n, i) => tone(midiToFreq(n), t + i * 0.11, 0.22, 'triangle', 0.3));
    },
    click() {
      if (!ensure()) return;
      tone(midiToFreq(84), now(), 0.06, 'sine', 0.2);
    },
    startMusic,
    stopMusic,
  };
}
