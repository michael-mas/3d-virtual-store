import { BEAT } from "./show";

/**
 * The performance's score, synthesized live with Web Audio and scheduled on the show's timeline (lib/gallery/show.ts).
 * Written to be easy on the ear: one key (D major, its relative B minor), sine and soft triangle voices only (no raw
 * sawtooth, no white noise in the music), harmonic bells and tuned mallets instead of metallic clanks, a warm low
 * kick and a whisper of a shaker, filters that open slowly instead of noise risers, a dark hall, gentle bus
 * compression and a shelf that tames the top end.
 *
 * - Prélude: the three knocks of the French theatre, then a low drone with a faint shimmer.
 * - Éveil: a bell for each automaton as it wakes (panned where it stands), a pad that opens.
 * - Mécanique: a soft pulse (kick, shaker, eighth-note bass) and a tuned mallet each time the automatons lock into a
 *   move, spread into a three-voice canon in the second phrase.
 * - Miroir: a night arpeggio with a ping-pong echo over a slow pad.
 * - Finale: a swell that opens and accelerates, two deep strokes, then silence for the blackout.
 * - Salut: a warm chord and descending bells. Applause (the visitor's) is a soft clap.
 *
 * No audio file. Started from the click that starts the show (browsers allow audio only after a user gesture).
 */

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const VOLUME = 0.75;

/** The chords (MIDI), voiced close and warm. */
const CHORD = {
  D: [50, 57, 61, 64, 66],
  Bm: [47, 54, 57, 61, 62],
  G: [43, 50, 54, 57, 61],
  A: [45, 52, 54, 57, 62],
  Dhigh: [62, 66, 69, 73, 76],
};
/** The mallet melody of the mechanical act: D major pentatonic. */
const PENTA = [62, 64, 66, 69, 71, 74, 76, 78];

export type Bus = { ctx: BaseAudioContext; dry: AudioNode; hall: AudioNode; echo: AudioNode; noise: AudioBuffer };

/** A dark stereo hall: decaying noise, low-passed more and more as it fades. */
function hallImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.round(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let low = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      low += (Math.random() * 2 - 1 - low) * (0.45 - 0.4 * t);
      data[i] = low * (1 - t) ** 2.4;
    }
  }
  return buffer;
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** The mix: sources → (dry | hall | echo) → shelf → glue compressor → limiter → destination. */
export function createBus(ctx: BaseAudioContext, destination: AudioNode, volume = VOLUME): { bus: Bus; master: GainNode } {
  const master = ctx.createGain();
  master.gain.value = volume;
  // Tame the top end (where synthesized sound gets tiring), keep the warmth.
  const shelf = ctx.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 5000;
  shelf.gain.value = -8;
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -20;
  glue.ratio.value = 2.5;
  glue.attack.value = 0.02;
  glue.release.value = 0.3;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.1;
  master.connect(shelf).connect(glue).connect(limiter).connect(destination);

  const dry = ctx.createGain();
  dry.connect(master);
  const reverb = ctx.createConvolver();
  reverb.buffer = hallImpulse(ctx, 3.4);
  const hall = ctx.createGain();
  hall.gain.value = 0.45;
  hall.connect(reverb).connect(master);
  // A dark ping-pong echo (dotted eighth), for the arpeggio.
  const echo = ctx.createGain();
  const merger = ctx.createChannelMerger(2);
  const left = ctx.createDelay(1);
  const right = ctx.createDelay(1);
  left.delayTime.value = BEAT * 0.75;
  right.delayTime.value = BEAT * 0.75;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2200;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  echo.connect(tone).connect(left);
  left.connect(right);
  right.connect(feedback).connect(left);
  left.connect(merger, 0, 0);
  right.connect(merger, 0, 1);
  const echoOut = ctx.createGain();
  echoOut.gain.value = 0.4;
  merger.connect(echoOut).connect(master);
  return { bus: { ctx, dry, hall, echo, noise: noiseBuffer(ctx) }, master };
}

/** Routes a voice: panned, to the dry bus, the hall and (optionally) the echo. */
function send(b: Bus, node: AudioNode, pan: number, wet: number, echo = 0) {
  const p = b.ctx.createStereoPanner();
  p.pan.value = pan;
  node.connect(p);
  p.connect(b.dry);
  const w = b.ctx.createGain();
  w.gain.value = wet;
  p.connect(w).connect(b.hall);
  if (echo) {
    const e = b.ctx.createGain();
    e.gain.value = echo;
    p.connect(e).connect(b.echo);
  }
}

type Voice = { type?: OscillatorType; pan?: number; wet?: number; echo?: number; cutoff?: number; cutoffTo?: number; detune?: number };

/** One oscillator with an attack / hold / release envelope. */
function voice(b: Bus, freq: number, at: number, attack: number, level: number, release: number, end: number, v: Voice = {}) {
  const { ctx } = b;
  const o = ctx.createOscillator();
  o.type = v.type ?? "sine";
  o.frequency.value = freq;
  o.detune.value = v.detune ?? 0;
  const g = ctx.createGain();
  if (attack >= 0.05) {
    // Swells (pads, drones): linear in and out, so overlapping chords cross-fade without a dip.
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + attack);
    g.gain.setValueAtTime(level, Math.max(at + attack, end - release));
    g.gain.linearRampToValueAtTime(0, end);
  } else {
    // Struck tones: instant attack, natural (exponential) decay.
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + attack);
    g.gain.setValueAtTime(level, Math.max(at + attack, end - release));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  }
  let node: AudioNode = o;
  if (v.cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 0.5;
    f.frequency.setValueAtTime(v.cutoff, at);
    if (v.cutoffTo) f.frequency.exponentialRampToValueAtTime(v.cutoffTo, end);
    node = o.connect(f);
  }
  node.connect(g);
  send(b, g, v.pan ?? 0, v.wet ?? 0.3, v.echo ?? 0);
  o.start(at);
  o.stop(end + 0.05);
  return o;
}

/** A struck tone: instant attack, exponential decay. */
const strike = (b: Bus, freq: number, at: number, level: number, decay: number, v: Voice = {}) => voice(b, freq, at, 0.004, level, decay, at + decay, v);

/** A warm pad: soft triangles through a low-pass, two voices a few cents apart, slow in and out. */
function pad(b: Bus, notes: number[], at: number, end: number, level: number, cutoff = 900, cutoffTo?: number) {
  const each = level / notes.length;
  notes.forEach((n, i) => {
    const pan = (i / Math.max(notes.length - 1, 1) - 0.5) * 0.7;
    for (const detune of [-4, 4]) voice(b, hz(n), at, 2.5, each, 2.5, end, { type: "triangle", pan, wet: 0.55, cutoff, cutoffTo, detune });
  });
}

/** A bell: harmonic partials only (fundamental, octave, twelfth), long decay. */
function bell(b: Bus, note: number, at: number, pan: number, level: number) {
  strike(b, hz(note), at, level, 3.2, { pan, wet: 0.6 });
  strike(b, hz(note) * 2, at, level * 0.22, 1.6, { pan, wet: 0.6 });
  strike(b, hz(note) * 3, at, level * 0.06, 0.8, { pan, wet: 0.6 });
}

/** A tuned mallet (marimba-like): a round body and a brief bright overtone. */
function mallet(b: Bus, note: number, at: number, pan: number, level: number) {
  strike(b, hz(note), at, level, 0.55, { pan, wet: 0.35 });
  strike(b, hz(note) * 4, at, level * 0.12, 0.07, { pan, wet: 0.2 });
}

/** A soft, round kick. */
function kick(b: Bus, at: number, level: number) {
  const o = strike(b, 80, at, level, 0.38, { wet: 0.05 });
  o.frequency.setValueAtTime(85, at);
  o.frequency.exponentialRampToValueAtTime(44, at + 0.14);
}

/** A whispered shaker: band-limited noise, very short and very low. */
function shaker(b: Bus, at: number, level: number, pan = 0.25) {
  const { ctx } = b;
  const src = ctx.createBufferSource();
  src.buffer = b.noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 3200;
  band.Q.value = 0.7;
  const soft = ctx.createBiquadFilter();
  soft.type = "lowpass";
  soft.frequency.value = 5500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(level, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  src.connect(band).connect(soft).connect(g);
  send(b, g, pan, 0.15);
  src.start(at, Math.random() * 0.5);
  src.stop(at + 0.08);
}

/** A wooden knock (the brigadier's staff on the stage floor). */
function knock(b: Bus, at: number) {
  const o = strike(b, 120, at, 0.5, 0.22, { wet: 0.45 });
  o.frequency.setValueAtTime(130, at);
  o.frequency.exponentialRampToValueAtTime(62, at + 0.12);
  strike(b, 340, at, 0.08, 0.06, { wet: 0.4 });
}

/** A deep stroke: a warm boom with its octave and fifth, long decay. */
function stroke(b: Bus, at: number) {
  strike(b, hz(26), at, 0.5, 3, { wet: 0.4 });
  strike(b, hz(38), at, 0.22, 2.2, { wet: 0.5 });
  strike(b, hz(45), at, 0.08, 1.6, { wet: 0.5 });
}

/** A soft hand clap: three tiny bursts of band-limited noise. */
export function clap(b: Bus, at: number, pan: number, level = 0.1) {
  const { ctx } = b;
  for (const offset of [0, 0.009, 0.02]) {
    const src = ctx.createBufferSource();
    src.buffer = b.noise;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1500 + Math.random() * 300;
    band.Q.value = 0.9;
    const g = ctx.createGain();
    const t = at + offset;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(band).connect(g);
    send(b, g, pan, 0.4);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.08);
  }
}

/** Schedules the whole score from `t0` (in the context's time). */
export function scheduleScore(b: Bus, t0: number) {
  const T = (t: number) => t0 + t;

  // Prélude: the three knocks, then the drone and a faint shimmer.
  [0.6, 1.5, 2.4].forEach((t) => knock(b, T(t)));
  voice(b, hz(38), T(3), 4, 0.16, 3, T(22.5), { wet: 0.3 });
  voice(b, hz(45), T(4), 4, 0.06, 3, T(22.5), { wet: 0.4 });
  voice(b, hz(81), T(5), 3, 0.006, 2, T(12), { wet: 0.8 });
  voice(b, hz(86), T(6), 3, 0.004, 2, T(12), { wet: 0.8 });

  // Éveil: a bell as each automaton wakes (center, left, right), the pad opening.
  [
    [9, 74, 0],
    [10.8, 78, -0.5],
    [12.6, 81, 0.5],
  ].forEach(([t, note, pan]) => bell(b, note, T(t), pan, 0.09));
  pad(b, CHORD.D, T(10), T(18.5), 0.14, 500, 1300);
  pad(b, CHORD.G, T(16), T(24.5), 0.12, 700, 1700);
  voice(b, hz(31), T(16), 2, 0.1, 2, T(22.5), { wet: 0.3 });
  bell(b, 69, T(19.5), 0, 0.05);

  // Mécanique: 44 beats. Kick on the bar's 1 and 3, shaker on the off-beats, the bass in eighths, a mallet per move.
  const PROGRESSION = [CHORD.D, CHORD.Bm, CHORD.G, CHORD.A];
  const ROOTS = [38, 35, 43, 45];
  for (let k = 0; k < 6; k++) {
    const at = 22 + k * 8 * BEAT;
    pad(b, PROGRESSION[k % 4], T(at), T(Math.min(at + 8 * BEAT + 2.5, 46.5)), 0.1, 900);
  }
  const pans = [-0.55, 0, 0.55];
  for (let beat = 0; beat < 44; beat++) {
    const at = 22 + beat * BEAT;
    const phrase = Math.floor(beat / 8);
    const root = ROOTS[Math.floor(beat / 8) % 4];
    if (beat % 2 === 0) kick(b, T(at), beat % 8 === 0 ? 0.6 : 0.48);
    shaker(b, T(at + BEAT / 2), 0.03);
    for (const half of [0, 0.5]) {
      const note = root + (half ? 12 : 0) + (beat % 4 === 3 && half ? 7 : 0);
      strike(b, hz(note - 12), T(at + half * BEAT), 0.18, 0.3, { type: "triangle", cutoff: 420, wet: 0.05 });
    }
    // The automatons lock into place: a mallet note each, in unison or (second phrase) in canon.
    const note = PENTA[(beat * 3 + phrase) % PENTA.length];
    if (phrase === 1) pans.forEach((pan, i) => mallet(b, note + (i === 1 ? 0 : i === 0 ? -5 : 7), T(at + i * BEAT * 0.5), pan, 0.11));
    else mallet(b, note, T(at), pans[beat % 3], 0.15);
  }

  // Miroir: an arpeggio in eighths with a ping-pong echo, over Bm9 then Gmaj9.
  const ARP = [
    [59, 62, 66, 69, 73, 69, 66, 62],
    [55, 59, 62, 66, 69, 66, 62, 59],
  ];
  for (let i = 0; i < 20 / (BEAT / 2); i++) {
    const at = 44 + i * (BEAT / 2);
    if (at > 63.7) break;
    const notes = ARP[at < 54 ? 0 : 1];
    strike(b, hz(notes[i % 8] + 12), T(at), 0.08, 0.9, { type: "triangle", cutoff: 2400, pan: Math.sin(i * 0.6) * 0.5, wet: 0.45, echo: 0.6 });
  }
  pad(b, CHORD.Bm, T(43.5), T(56.5), 0.13, 700);
  pad(b, CHORD.G, T(54), T(66.5), 0.13, 800);
  voice(b, hz(35), T(44), 2, 0.09, 2, T(54.5), { wet: 0.3 });
  voice(b, hz(31), T(54), 2, 0.09, 2, T(64.5), { wet: 0.3 });
  for (let bar = 0; bar < 10; bar++) kick(b, T(44 + bar * 4 * BEAT), 0.18);

  // Finale: a swell that opens (A6sus → D), an arpeggio that accelerates, two deep strokes, then silence.
  pad(b, CHORD.A, T(63.5), T(70.5), 0.15, 500, 1600);
  pad(b, [...CHORD.D, 69, 74], T(68), T(74), 0.2, 900, 2600);
  voice(b, hz(33), T(64), 2, 0.1, 1.5, T(68.4), { wet: 0.3 });
  voice(b, hz(38), T(68), 1.5, 0.12, 1, T(74), { wet: 0.3 });
  let at = 64.5;
  let step = BEAT;
  let i = 0;
  while (at < 71.6) {
    strike(b, hz(CHORD.Dhigh[i % 5] + (i % 10 >= 5 ? 12 : 0)), T(at), 0.07, 0.6, { type: "triangle", cutoff: 3000, pan: Math.sin(i) * 0.6, wet: 0.5 });
    at += step;
    step = Math.max(step * 0.9, BEAT / 4);
    i++;
  }
  for (const h of [72, 73]) {
    stroke(b, T(h));
    CHORD.Dhigh.forEach((n, k) => strike(b, hz(n - 12), T(h + k * 0.012), 0.05, 1.6, { type: "triangle", cutoff: 2600, pan: (k - 2) * 0.25, wet: 0.6 }));
  }

  // Salut: a warm chord and descending bells, then the house lights.
  pad(b, [...CHORD.D, 69], T(76.2), T(88), 0.13, 800, 1200);
  voice(b, hz(38), T(76.2), 2.5, 0.08, 3, T(88), { wet: 0.4 });
  [77, 78.4, 79.6, 80.8].forEach((t, k) => bell(b, [86, 81, 78, 74][k], T(t), [-0.4, 0.4, -0.2, 0.2][k], 0.06));
}

type Live = { ctx: AudioContext; master: GainNode; bus: Bus };
let live: Live | null = null;

/** Starts the score `delay` seconds from now (call from the click that starts the show). */
export function startScore(delay: number) {
  if (typeof AudioContext === "undefined") return;
  stopScore();
  const ctx = new AudioContext();
  const { bus, master } = createBus(ctx, ctx.destination);
  live = { ctx, master, bus };
  void ctx.resume();
  scheduleScore(bus, ctx.currentTime + delay);
}

/** A clap from the audience (the visitor's applause), on the running score's mix. */
export function applaud() {
  if (!live) return;
  clap(live.bus, live.ctx.currentTime + 0.005, Math.random() * 0.6 - 0.3);
}

/** Fades the score out and releases the audio device. */
export function stopScore() {
  const s = live;
  if (!s) return;
  live = null;
  const t = s.ctx.currentTime;
  s.master.gain.cancelScheduledValues(t);
  s.master.gain.setValueAtTime(s.master.gain.value, t);
  s.master.gain.linearRampToValueAtTime(0, t + 1.2);
  setTimeout(() => void s.ctx.close(), 1400);
}

/** Renders the whole score offline (debug: to listen to it and measure it). */
export async function renderScore(seconds = 92, sampleRate = 44100): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const { bus } = createBus(ctx, ctx.destination);
  scheduleScore(bus, 0.05);
  return ctx.startRendering();
}
