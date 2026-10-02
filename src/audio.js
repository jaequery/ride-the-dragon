// All of the game's sound, synthesized with Web Audio: no audio files, in
// keeping with the procedural geometry. A lookahead sequencer plays the music
// one 16th-note step at a time; sound effects are short one-shot voices.
// Every call is a silent no-op until unlock() runs from a user gesture, and
// forever if the browser has no Web Audio.

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const LOOKAHEAD = 0.12; // seconds of music scheduled ahead of the clock
const TICK_MS = 25;

// Chords are MIDI roots plus intervals; each lasts one bar of 16 steps.
const TRACKS = {
  // Calm, slow and sparse: a pad and a gentle arpeggio, no drums or bass.
  menu: {
    bpm: 84,
    chords: [
      [57, [0, 3, 7]], // Am
      [53, [0, 4, 7]], // F
      [48, [0, 4, 7]], // C
      [55, [0, 4, 7]], // G
    ],
    pad: true,
    pluck: [0, 4, 8, 12],
  },
  // Fast, loud and relentless: four-on-the-floor kick, snare backbeat,
  // 16th hats, a galloping bass and a 16th-note lead over a minor progression
  // that resolves through a harmonic-minor A major.
  battle: {
    bpm: 160,
    chords: [
      [50, [0, 3, 7]], // Dm
      [46, [0, 4, 7]], // Bb
      [48, [0, 4, 7]], // C
      [45, [0, 4, 7]], // A
    ],
    drums: true,
    bass: [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 7, 0, 12, 10],
    lead: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 2, 3],
  },
};

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.track = null; // the wanted track, remembered even before unlock
    this.danger = false; // low HP: the battle music adds an alarm and double kicks
    this.muted = false;
    this.step = 0;
    this.nextStep = 0;
    this.timer = null;
  }

  get state() {
    return this.ctx ? this.ctx.state : 'locked';
  }

  // Browsers only let audio start from a user gesture, so main.js calls this
  // on every key press and click; after the first it just resumes.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = (this.ctx = new Ctx());

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(comp);
    this.music = ctx.createGain();
    this.music.gain.value = 0.55;
    this.music.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.makeBreath();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend();
      else ctx.resume();
    });
    if (ctx.state === 'suspended') ctx.resume();
    this.restartMusic();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  // ---------- music ----------
  setTrack(name) {
    if (name === this.track) return;
    this.track = name;
    this.restartMusic();
  }

  restartMusic() {
    if (!this.ctx) return;
    clearInterval(this.timer);
    this.timer = null;
    if (!this.track) return;
    this.step = 0;
    this.nextStep = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  schedule() {
    const ctx = this.ctx;
    const song = TRACKS[this.track];
    // After a throttled or suspended stretch, pick up from now instead of
    // firing every missed note at once.
    if (this.nextStep < ctx.currentTime - 0.2) this.nextStep = ctx.currentTime + 0.05;
    while (this.nextStep < ctx.currentTime + LOOKAHEAD) {
      this.playStep(song, this.step, this.nextStep);
      this.nextStep += 60 / song.bpm / 4;
      this.step = (this.step + 1) % (song.chords.length * 16);
    }
  }

  playStep(song, step, at) {
    const s = step % 16;
    const [root, chord] = song.chords[Math.floor(step / 16)];
    const sixteenth = 60 / song.bpm / 4;
    const out = this.music;

    if (song.pad && s === 0) {
      for (const iv of chord) this.tone(at, midi(root + iv), sixteenth * 16, { type: 'triangle', gain: 0.07, attack: 0.6, release: 1.2, dest: out });
    }
    if (song.pluck?.includes(s)) {
      const iv = chord[(s / 4) % chord.length];
      this.tone(at, midi(root + 12 + iv), sixteenth * 3, { type: 'sine', gain: 0.1, attack: 0.01, release: 0.5, dest: out });
    }

    if (song.drums) {
      const fill = step % 64 >= 60; // last beat of the loop
      if (s % 4 === 0 || (this.danger && s % 2 === 0) || s === 14) this.kick(at, 0.9);
      if (s === 4 || s === 12 || fill) this.snare(at, fill ? 0.25 + (s - 12) * 0.08 : 0.45);
      this.hat(at, s % 2 ? 0.12 : 0.06);
      if (step % 64 === 0) this.crash(at, 0.25);
    }
    if (song.bass) {
      const n = root - 12 + song.bass[s];
      this.tone(at, midi(n), sixteenth * 0.9, { type: 'sawtooth', gain: 0.16, attack: 0.005, release: 0.06, cutoff: 900, dest: out });
    }
    if (song.lead) {
      const tones = [...chord, 12, chord[1] + 12];
      const n = root + 24 + tones[song.lead[s] % tones.length];
      this.tone(at, midi(n), sixteenth * 0.8, { type: 'square', gain: 0.045, attack: 0.005, release: 0.05, cutoff: 3200, dest: out });
    }
    if (song.drums && this.danger && s % 4 === 0) {
      // A two-note alarm over the beat while the dragon is close to death.
      this.tone(at, midi(s % 8 ? 81 : 84), sixteenth * 1.8, { type: 'sawtooth', gain: 0.04, attack: 0.01, release: 0.05, cutoff: 2500, dest: out });
    }
  }

  // ---------- voices ----------
  // One enveloped oscillator, optionally through a lowpass, with an optional
  // pitch glide to `to`.
  tone(at, freq, dur, { type = 'sine', gain = 0.2, attack = 0.01, release = 0.1, cutoff, to, dest = this.sfx } = {}) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + attack);
    env.gain.setValueAtTime(gain, at + Math.max(attack, dur - release));
    env.gain.linearRampToValueAtTime(0, at + dur);
    let node = osc;
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      node.connect(f);
      node = f;
    }
    node.connect(env).connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  // A burst of white noise through a filter whose frequency can sweep.
  burst(at, dur, { gain = 0.3, type = 'lowpass', freq = 2000, to, q = 1, dest = this.sfx } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, at);
    if (to) f.frequency.exponentialRampToValueAtTime(to, at + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(f).connect(env).connect(dest);
    src.start(at, Math.random() * 1.5);
    src.stop(at + dur);
  }

  kick(at, gain) {
    this.tone(at, 150, 0.22, { gain, attack: 0.002, release: 0.2, to: 40, dest: this.music });
  }

  snare(at, gain) {
    this.burst(at, 0.16, { gain, type: 'highpass', freq: 1200, dest: this.music });
    this.tone(at, 190, 0.08, { type: 'triangle', gain: gain * 0.5, attack: 0.002, release: 0.07, to: 120, dest: this.music });
  }

  hat(at, gain) {
    this.burst(at, 0.04, { gain, type: 'highpass', freq: 7500, dest: this.music });
  }

  crash(at, gain) {
    this.burst(at, 1.4, { gain, type: 'highpass', freq: 4000, dest: this.music });
  }

  // The fire breath is one looping noise voice that fades in and out while
  // Space is held, with its own flicker so it crackles.
  makeBreath() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 700;
    f.Q.value = 0.6;
    const flicker = ctx.createOscillator();
    flicker.frequency.value = 13;
    const depth = ctx.createGain();
    depth.gain.value = 350;
    flicker.connect(depth).connect(f.frequency);
    this.breath = ctx.createGain();
    this.breath.gain.value = 0;
    src.connect(f).connect(this.breath).connect(this.sfx);
    src.start();
    flicker.start();
    this.breathing = false;
  }

  setBreath(on) {
    if (!this.ctx || on === this.breathing) return;
    this.breathing = on;
    this.breath.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, on ? 0.03 : 0.08);
  }

  // ---------- sound effects ----------
  get now() {
    return this.ctx.currentTime;
  }

  explode() {
    if (!this.ctx) return;
    const at = this.now;
    this.burst(at, 0.7, { gain: 0.7, freq: 2500, to: 150 });
    this.tone(at, 110, 0.5, { gain: 0.5, attack: 0.005, release: 0.4, to: 35 });
  }

  hurt() {
    if (!this.ctx) return;
    const at = this.now;
    this.tone(at, 220, 0.25, { type: 'square', gain: 0.2, attack: 0.003, release: 0.2, to: 70, cutoff: 1500 });
    this.tone(at, 80, 0.3, { gain: 0.6, attack: 0.003, release: 0.25, to: 40 });
    this.burst(at, 0.15, { gain: 0.3, freq: 1500 });
  }

  // Enemy fire, quieter the farther away it is.
  shot(distance = 0) {
    if (!this.ctx) return;
    const gain = 0.15 * Math.max(0.15, 1 - distance / 500);
    this.tone(this.now, 1400, 0.15, { type: 'sawtooth', gain, attack: 0.002, release: 0.12, to: 300, cutoff: 3000 });
  }

  ring() {
    if (!this.ctx) return;
    const at = this.now;
    this.tone(at, midi(88), 0.12, { type: 'triangle', gain: 0.25 });
    this.tone(at + 0.08, midi(95), 0.3, { type: 'triangle', gain: 0.25, release: 0.25 });
  }

  combo() {
    if (!this.ctx) return;
    const at = this.now;
    [72, 76, 79, 84].forEach((n, i) => this.tone(at + i * 0.07, midi(n), 0.25, { type: 'square', gain: 0.1, cutoff: 4000 }));
  }

  roll() {
    if (!this.ctx) return;
    this.burst(this.now, 0.6, { gain: 0.35, type: 'bandpass', freq: 400, to: 2500, q: 2 });
  }

  gameOver() {
    if (!this.ctx) return;
    this.setBreath(false);
    const at = this.now;
    this.burst(at, 1.5, { gain: 0.8, freq: 1800, to: 80 });
    [69, 65, 62, 57].forEach((n, i) => this.tone(at + 0.25 + i * 0.3, midi(n), 0.5, { type: 'sawtooth', gain: 0.14, cutoff: 1800, release: 0.3 }));
  }
}
