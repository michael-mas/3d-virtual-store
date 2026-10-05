/**
 * The salon's ambient music, synthesized live with Web Audio: no audio file, nothing to download or license. A slow
 * lounge progression of soft pads over a sine bass, with sparse bell notes, all through a generated hall reverb.
 * Off by default; started only from a user gesture (browsers block audio otherwise).
 */

/** Pad voicings (MIDI notes): Dmaj9, Bm9, Gmaj7(#11), A6sus. */
const CHORDS = [
  [38, 50, 57, 61, 64, 66],
  [35, 47, 54, 57, 61, 62],
  [31, 43, 50, 54, 59, 61],
  [33, 45, 52, 54, 59, 62],
];
/** Bell notes: D major pentatonic, two octaves up. */
const BELLS = [74, 76, 78, 81, 83, 86, 88, 90];
const CHORD_SECONDS = 9;
const VOLUME = 0.16;
const LOOKAHEAD_S = 1.5;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

type Engine = { ctx: AudioContext; master: GainNode; pad: AudioNode; bells: AudioNode; timer: number; next: number; step: number };
let engine: Engine | null = null;
let playing = false;

/** Stereo hall impulse response: decaying noise, darker as it fades. */
function hallImpulse(ctx: AudioContext, seconds = 4.5): AudioBuffer {
  const length = Math.round(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let low = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      low += (Math.random() * 2 - 1 - low) * (0.6 - 0.5 * t);
      data[i] = low * (1 - t) ** 3;
    }
  }
  return buffer;
}

function createEngine(): Engine {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0;
  const compressor = ctx.createDynamicsCompressor();
  master.connect(compressor).connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = hallImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  reverb.connect(wet).connect(master);

  // Pads: warm low-passed bus, half dry, half into the hall.
  const pad = ctx.createBiquadFilter();
  pad.type = "lowpass";
  pad.frequency.value = 1100;
  pad.Q.value = 0.4;
  const padDry = ctx.createGain();
  padDry.gain.value = 0.6;
  pad.connect(padDry).connect(master);
  pad.connect(reverb);

  // Bells: mostly reverb.
  const bells = ctx.createGain();
  bells.gain.value = 0.35;
  bells.connect(master);
  bells.connect(reverb);

  return { ctx, master, pad, bells, timer: 0, next: 0, step: 0 };
}

/** One chord: two slightly detuned voices per note, slow swell and release overlapping the next chord. */
function scheduleChord(e: Engine, notes: number[], at: number) {
  const { ctx } = e;
  const end = at + CHORD_SECONDS + 3;
  notes.forEach((note, i) => {
    const bass = i === 0;
    for (const detune of bass ? [0] : [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = bass ? "sine" : "triangle";
      osc.frequency.value = hz(note);
      osc.detune.value = detune;
      const gain = ctx.createGain();
      const level = bass ? 0.22 : 0.05;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(level, at + 3);
      gain.gain.setValueAtTime(level, end - 4);
      gain.gain.linearRampToValueAtTime(0, end);
      osc.connect(gain).connect(e.pad);
      osc.start(at);
      osc.stop(end + 0.1);
    }
  });
}

/** A soft bell: sine with a faint octave partial, quick attack, long decay, panned. */
function scheduleBell(e: Engine, at: number) {
  const { ctx } = e;
  const note = BELLS[Math.floor(Math.random() * BELLS.length)];
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.random() * 1.4 - 0.7;
  pan.connect(e.bells);
  for (const [ratio, level] of [
    [1, 0.08],
    [2, 0.015],
  ]) {
    const osc = ctx.createOscillator();
    osc.frequency.value = hz(note) * ratio;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 3.5);
    osc.connect(gain).connect(pan);
    osc.start(at);
    osc.stop(at + 3.6);
  }
}

/** Keeps a little music scheduled ahead of the clock. */
function tick(e: Engine) {
  const horizon = e.ctx.currentTime + LOOKAHEAD_S;
  while (e.next < horizon) {
    const at = e.next;
    scheduleChord(e, CHORDS[e.step % CHORDS.length], at);
    // Two to four bells somewhere in the chord.
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) scheduleBell(e, at + 1.5 + Math.random() * (CHORD_SECONDS - 2));
    e.step++;
    e.next = at + CHORD_SECONDS;
  }
}

/** Starts (fade in) or stops (fade out) the music. Must first be called from a user gesture. */
export async function setAmbientMusic(on: boolean) {
  if (on === playing) return;
  playing = on;
  if (on) {
    engine ??= createEngine();
    const e = engine;
    await e.ctx.resume();
    if (!playing) return;
    const now = e.ctx.currentTime;
    if (e.next < now) e.next = now + 0.1;
    tick(e);
    window.clearInterval(e.timer);
    e.timer = window.setInterval(() => tick(e), 500);
    e.master.gain.cancelScheduledValues(now);
    e.master.gain.setValueAtTime(e.master.gain.value, now);
    e.master.gain.linearRampToValueAtTime(VOLUME, now + 2.5);
  } else if (engine) {
    const e = engine;
    const now = e.ctx.currentTime;
    e.master.gain.cancelScheduledValues(now);
    e.master.gain.setValueAtTime(e.master.gain.value, now);
    e.master.gain.linearRampToValueAtTime(0, now + 1.2);
    window.clearInterval(e.timer);
    setTimeout(() => {
      // Still off after the fade: release the audio device. Pending notes resume with it later, faded in.
      if (!playing) void e.ctx.suspend();
    }, 1300);
  }
}
