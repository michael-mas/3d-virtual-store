import { uniform } from "three/tsl";
import { Color, Vector2, Vector3, Vector4 } from "three/webgpu";
import { setAmbientMusic } from "@/lib/ambient";
import { GALLERY } from "@/lib/explore/layout";
import { player, walkTo } from "@/lib/explore/player";
import { useAppStore } from "@/store/useAppStore";
import { applaud, startScore, stopScore } from "./score";
import { APPLAUSE, SHOW_DURATION } from "./show";

/**
 * The gallery's live state, shared by its shaders (TSL uniforms, updated once a frame by the Gallery and Theatre
 * components) and the performance's clock.
 */
export const stageUniforms = {
  /** Seconds since the gallery was mounted (interactions are timed on it). */
  clock: uniform(0),
  /** Gallery lights, 1 full … 0 off (the baked room, the painted works). */
  house: uniform(1),
  /** The visitor on the floor plan (x, z). */
  visitor: uniform(new Vector2()),
  rimColor: uniform(new Color()),
  rimLevel: uniform(0),
  visorColor: uniform(new Color(1, 0.8, 0.5)),
  visorLevel: uniform(0.15),
  /** The cyclorama: 0 its own slow drift (Lumière lente), 1 the show's color. */
  cycloShow: uniform(0),
  cycloColor: uniform(new Color()),
  cycloLevel: uniform(0),
  /** The swarm: weights of cloud, ring, helix, sphere; rain; glow; color; pull toward the attractor. */
  swarmWeights: uniform(new Vector4(1, 0, 0, 0)),
  swarmRain: uniform(0),
  swarmIntensity: uniform(0.25),
  swarmColor: uniform(new Color(1, 0.72, 0.32)),
  swarmAttract: uniform(0),
  /** The swarm's own clock: it runs slower in the finale's slow-motion beat. */
  swarmClock: uniform(0),
  swarmAttractor: uniform(new Vector3()),
};

/**
 * The performance: playing or not, its start (performance.now seconds), whether the director has the camera, and the
 * applause (claps; when it brought the automatons back for a second bow).
 */
export const show = { playing: false, start: 0, cinema: true, claps: 0, encore: null as number | null };

const now = () => performance.now() / 1000;
/** Seconds into the performance. */
export const showTime = () => (show.playing ? now() - show.start : 0);

/** Starts « Les Trois Automates » (from a click: the music needs a user gesture). */
export function startShow() {
  if (show.playing) return;
  // Take a seat facing the stage first.
  const [ax, az] = GALLERY.audience;
  if (Math.hypot(player.position[0] - ax, player.position[1] - az) > 0.8) walkTo([ax, az]);
  show.playing = true;
  show.cinema = true;
  show.start = now() + 0.2;
  show.claps = 0;
  show.encore = null;
  void setAmbientMusic(false);
  startScore(0.2);
  useAppStore.getState().setShow({ showPlaying: true, showCinema: true });
  useAppStore.getState().addStamp("automates");
}

/** Ends the performance (at its end, or when the visitor leaves it). */
export function stopShow() {
  if (!show.playing) return;
  show.playing = false;
  stopScore();
  const { musicOn, setShow } = useAppStore.getState();
  if (musicOn) void setAmbientMusic(true);
  setShow({ showPlaying: false, showCinema: false });
}

/** The director's camera on or off (off: the visitor looks and moves freely). */
export function setCinema(on: boolean) {
  show.cinema = on;
  useAppStore.getState().setShow({ showCinema: on });
}

export const showEnded = () => show.playing && showTime() > SHOW_DURATION;

/** Applause during the bow: a clap; the third brings the automatons back for a second bow. */
export function clap() {
  const t = showTime();
  if (!show.playing || t < APPLAUSE.start || t > APPLAUSE.end) return;
  applaud();
  show.claps++;
  if (show.claps >= 3 && show.encore === null && t < APPLAUSE.end - 2) show.encore = t;
}
