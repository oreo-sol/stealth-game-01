// Small WebAudio sound effects, all synthesized — no audio files. The context is created
// lazily on the first user gesture (browsers block audio before one), and M mutes it.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let ambient = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = null) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, gain, filterFreq) {
    if (!ensure() || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  }

  const sounds = {
    pickup() {
      tone(880, 0.09, 'sine', 0.25);
      tone(1318, 0.14, 'sine', 0.22, 0.07);
    },
    spotted() {
      tone(620, 0.12, 'square', 0.12, 0, 780);
    },
    alarm() {
      tone(392, 0.5, 'sawtooth', 0.16, 0, 311);
      tone(392, 0.5, 'sawtooth', 0.16, 0.55, 311);
    },
    caught() {
      tone(160, 0.5, 'sawtooth', 0.25, 0, 70);
    },
    level() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'sine', 0.22, i * 0.09));
    },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, 'sine', 0.22, i * 0.11));
    },
    smoke() {
      noise(0.5, 0.3, 900);
    },
    pebble() {
      tone(1400, 0.05, 'square', 0.12);
      noise(0.08, 0.2, 3000);
    },
    chime() {
      tone(1568, 0.4, 'sine', 0.2);
      tone(2093, 0.5, 'sine', 0.12, 0.05);
    },
    click() {
      tone(700, 0.05, 'sine', 0.15);
    },
  };

  function startAmbient() {
    if (!ensure() || ambient) return;
    try {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i += 1) {
        last = last * 0.98 + (Math.random() * 2 - 1) * 0.02;
        data[i] = last * 3;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start();
      ambient = src;
    } catch {
      // Ambient is decoration; silence is fine.
    }
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
      startAmbient();
    },
    play(name) {
      if (sounds[name]) sounds[name]();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
