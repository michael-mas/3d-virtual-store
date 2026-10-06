import { BEAT } from "./show";

/**
 * The performance's score, synthesized live with Web Audio and scheduled on the show's timeline (lib/gallery/show.ts):
 * a drone and wind in the dark, a bell for each automaton waking (panned where it stands), the mechanical act's
 * pulse (kick, hats, metallic clanks, a bass ostinato), a night arpeggio for the mirror, a riser and two hits for the
 * finale, then silence in the blackout and a warm chord for the bow. No audio file. Started from the click that
 * starts the show (browsers allow audio only after a user gesture).
 */

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const VOLUME = 0.5;

type Score = { ctx: AudioContext; master: GainNode; dry: GainNode; hall: GainNode; noise: AudioBuffer };
let score: Score | null = null;

function hallImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.round(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2.6;
  }
  return buffer;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** A gain envelope: 0 → peak over `attack`, held, then down to 0 by `end`. */
function envelope(ctx: AudioContext, at: number, attack: number, peak: number, end: number, exponential = false): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  if (exponential) g.gain.exponentialRampToValueAtTime(0.0001, end);
  else g.gain.linearRampToValueAtTime(0, end);
  return g;
}

function out(s: Score, node: AudioNode, pan: number, wet: number) {
  const p = s.ctx.createStereoPanner();
  p.pan.value = pan;
  node.connect(p);
  const d = s.ctx.createGain();
  d.gain.value = 1;
  p.connect(d).connect(s.dry);
  const w = s.ctx.createGain();
  w.gain.value = wet;
  p.connect(w).connect(s.hall);
}

function tone(s: Score, type: OscillatorType, freq: number, at: number, attack: number, peak: number, end: number, opts: { pan?: number; wet?: number; cutoff?: number; detune?: number; exp?: boolean } = {}) {
  const { ctx } = s;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = opts.detune ?? 0;
  let node: AudioNode = o;
  if (opts.cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = opts.cutoff;
    node = node.connect(f);
  }
  const g = envelope(ctx, at, attack, peak, end, opts.exp);
  node.connect(g);
  out(s, g, opts.pan ?? 0, opts.wet ?? 0.3);
  o.start(at);
  o.stop(end + 0.05);
  return o;
}

function noise(s: Score, at: number, dur: number, peak: number, filter: BiquadFilterType, freq: number, opts: { pan?: number; wet?: number; to?: number; q?: number; attack?: number } = {}) {
  const { ctx } = s;
  const src = ctx.createBufferSource();
  src.buffer = s.noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, at);
  if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, at + dur);
  f.Q.value = opts.q ?? 0.8;
  const g = envelope(ctx, at, opts.attack ?? 0.002, peak, at + dur, !opts.attack);
  src.connect(f).connect(g);
  out(s, g, opts.pan ?? 0, opts.wet ?? 0.2);
  src.start(at);
  src.stop(at + dur + 0.05);
}

function kick(s: Score, at: number, level = 0.9) {
  const o = tone(s, "sine", 120, at, 0.003, level, at + 0.35, { wet: 0.05, exp: true });
  o.frequency.setValueAtTime(130, at);
  o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
}

/** A metallic hit: inharmonic partials, quick decay (an automaton's joint locking into place). */
function clank(s: Score, at: number, pan: number, level = 0.22) {
  for (const [ratio, l] of [
    [1, 1],
    [2.76, 0.6],
    [5.4, 0.35],
    [8.93, 0.2],
  ]) {
    tone(s, "sine", 420 * ratio, at, 0.001, level * l, at + 0.35 / ratio ** 0.3, { pan, wet: 0.35, exp: true });
  }
  noise(s, at, 0.05, level * 0.6, "highpass", 5000, { pan });
}

function bell(s: Score, midi: number, at: number, pan: number, level = 0.12) {
  tone(s, "sine", hz(midi), at, 0.005, level, at + 4, { pan, wet: 0.7, exp: true });
  tone(s, "sine", hz(midi) * 2.01, at, 0.005, level * 0.25, at + 2, { pan, wet: 0.7, exp: true });
}

function chord(s: Score, notes: number[], at: number, attack: number, end: number, level: number, cutoff = 1400, type: OscillatorType = "triangle") {
  notes.forEach((n, i) => {
    for (const detune of [-7, 7]) tone(s, type, hz(n), at, attack, level, end, { pan: (i / (notes.length - 1) - 0.5) * 0.8, wet: 0.55, cutoff, detune });
  });
}

/** Schedules the whole score from `delay` seconds from now. */
function schedule(s: Score, t0: number) {
  // Prelude: a low drone and the wind.
  tone(s, "sine", hz(26), t0, 5, 0.35, t0 + 22, { wet: 0.2 });
  tone(s, "sine", hz(38), t0 + 1, 5, 0.18, t0 + 22, { wet: 0.3 });
  noise(s, t0, 9, 0.12, "bandpass", 300, { to: 1400, attack: 5, wet: 0.6, q: 2 });

  // Awakening: a bell as each automaton wakes (center, left, right), a pad that opens.
  [
    [9, 74, 0],
    [10.8, 69, -0.6],
    [12.6, 76, 0.6],
  ].forEach(([at, note, pan]) => bell(s, note, t0 + at, pan, 0.16));
  chord(s, [50, 57, 62, 64, 69], t0 + 10, 6, t0 + 22.4, 0.035, 900);
  chord(s, [50, 57, 62, 65, 72], t0 + 16, 4, t0 + 22.4, 0.03, 1800);
  noise(s, t0 + 20, 2, 0.15, "bandpass", 400, { to: 5000, attack: 1.9, wet: 0.4 });

  // Mechanical: 44 beats of pulse.
  const BASS = [38, 38, 50, 38, 41, 38, 45, 43];
  for (let b = 0; b < 44; b++) {
    const at = t0 + 22 + b * BEAT;
    const phrase = Math.floor(b / 8);
    kick(s, at, b % 8 === 0 ? 1 : 0.75);
    noise(s, at + BEAT / 2, 0.06, 0.06, "highpass", 7000, { pan: 0.3 });
    if (b % 8 === 0) noise(s, at, 1.6, 0.18, "highpass", 3500, { wet: 0.5 });
    // Each automaton's joints lock on the beat, panned where it stands (the canon spreads them).
    const pans = [-0.6, 0, 0.6];
    pans.forEach((pan, i) => clank(s, at + (phrase === 1 ? i * BEAT : 0) + i * 0.012, pan, phrase === 1 ? 0.14 : 0.08));
    for (const half of [0, 0.5]) tone(s, "sawtooth", hz(BASS[(b * 2 + half * 2) % 8] - 12), at + half * BEAT, 0.005, 0.12, at + half * BEAT + 0.22, { cutoff: 520, wet: 0.05, exp: true });
  }
  chord(s, [50, 57, 62, 66, 69], t0 + 42, 2, t0 + 46, 0.03, 2000, "sawtooth");

  // Mirror: a night arpeggio in sixteenths, a slow pad, a soft half-time pulse.
  const ARP = [62, 65, 69, 72, 74, 72, 69, 65];
  for (let i = 0; i < 20 / (BEAT / 4); i++) {
    const at = t0 + 44 + i * (BEAT / 4);
    if (at > t0 + 63.8) break;
    const n = ARP[i % 8] + (Math.floor(i / 32) % 2 === 1 ? -2 : 0);
    tone(s, "triangle", hz(n + 12), at, 0.004, 0.05, at + 0.28, { pan: Math.sin(i * 0.7) * 0.7, wet: 0.6, exp: true });
  }
  chord(s, [46, 53, 58, 62, 69], t0 + 44, 4, t0 + 54.5, 0.03, 900);
  chord(s, [43, 50, 55, 62, 67], t0 + 54, 4, t0 + 64.5, 0.03, 1100);
  for (let b = 0; b < 20; b++) kick(s, t0 + 44 + b * BEAT * 2, 0.4);

  // Finale: a riser, a rising chord, two hits, then silence for the blackout.
  noise(s, t0 + 64, 7.5, 0.22, "bandpass", 200, { to: 7000, attack: 7.4, wet: 0.5, q: 1.5 });
  chord(s, [50, 57, 62, 66, 69, 74], t0 + 66, 5, t0 + 74, 0.04, 2600, "sawtooth");
  for (const h of [72, 73]) {
    kick(s, t0 + h, 1);
    noise(s, t0 + h, 1.4, 0.3, "highpass", 2500, { wet: 0.6 });
    chord(s, [38, 50, 57, 62, 66], t0 + h, 0.01, t0 + h + 0.9, 0.06, 3000, "sawtooth");
  }

  // The bow: a warm chord and a few bells.
  chord(s, [50, 57, 62, 64, 66, 69], t0 + 76.2, 2.5, t0 + 84, 0.035, 1200);
  [77, 78.4, 79.6, 80.5].forEach((at, i) => bell(s, [74, 78, 81, 86][i], t0 + at, [-0.5, 0.5, -0.2, 0.2][i], 0.08));
}

/** Starts the score `delay` seconds from now (call from the click that starts the show). */
export function startScore(delay: number) {
  if (typeof AudioContext === "undefined") return;
  stopScore();
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = VOLUME;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  const dry = ctx.createGain();
  dry.connect(master);
  const reverb = ctx.createConvolver();
  reverb.buffer = hallImpulse(ctx, 3.8);
  const hall = ctx.createGain();
  hall.gain.value = 0.6;
  hall.connect(reverb).connect(master);
  score = { ctx, master, dry, hall, noise: noiseBuffer(ctx) };
  void ctx.resume();
  schedule(score, ctx.currentTime + delay);
}

/** Fades the score out and releases the audio device. */
export function stopScore() {
  const s = score;
  if (!s) return;
  score = null;
  const t = s.ctx.currentTime;
  s.master.gain.cancelScheduledValues(t);
  s.master.gain.setValueAtTime(s.master.gain.value, t);
  s.master.gain.linearRampToValueAtTime(0, t + 0.8);
  setTimeout(() => void s.ctx.close(), 1000);
}
