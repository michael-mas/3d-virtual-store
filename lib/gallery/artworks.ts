import { FLOOR_Y, GALLERY, type Vec2 } from "@/lib/explore/layout";

/**
 * The works shown in the gallery behind the entrance wall (fictional artists; the titles are proper names and stay
 * in French, the medium and the note go through the i18n catalog). Their places come from showroom-layout.json
 * (`gallery.works`: wall and position along it; `gallery.sculptures`: one per plinth, in order).
 */
export type ArtworkId =
  | "champ-d-or"
  | "maree"
  | "constellation"
  | "fragment"
  | "miroir-noir"
  | "miroir-vivant"
  | "ruban"
  | "equilibre"
  | "noeud"
  | "monolithe"
  | "pluie-d-or"
  | "automates";

/** `gesture`: what touching the work does (the label's button; a click on the work does the same). */
type Notice = { title: string; artist: string; year: number; medium: string; note: string; gesture?: string };

const NOTICES: Record<ArtworkId, Notice> = {
  "champ-d-or": {
    title: "Champ d'or",
    artist: "Aurèle Vasseur",
    year: 2021,
    medium: "Gold leaf on panel",
    note: "Twelve hundred squares of gold leaf, laid by hand. Each one catches the light at its own angle, so the field changes as you walk past it.",
    gesture: "Touch the gold",
  },
  maree: {
    title: "Marée",
    artist: "Noa Hirata",
    year: 2019,
    medium: "Light and pigment, endless loop",
    note: "A horizon that never settles: the sea breathes at the pace of a sleeping tide, one wave every eleven seconds.",
    gesture: "Touch the sea",
  },
  constellation: {
    title: "Constellation",
    artist: "Elias Morel",
    year: 2023,
    medium: "Brass points on black lacquer",
    note: "Brass points set where the stars stood above Paris on the night the house opened. A few of them still flicker.",
    gesture: "Wake the stars",
  },
  fragment: {
    title: "Fragment",
    artist: "Lucia Ferrante",
    year: 2018,
    medium: "Cut canvas",
    note: "A single cut, made in one gesture. What matters is the space behind it.",
    gesture: "Open the cut",
  },
  "miroir-noir": {
    title: "Miroir noir",
    artist: "Atelier Prisma Aurum",
    year: 2025,
    medium: "Polished obsidian, brass",
    note: "The house's emblem: a black mirror, which painters once used to judge their values. Come closer: the emblem surfaces from its depth.",
    gesture: "Light the emblem",
  },
  "miroir-vivant": {
    title: "Le Miroir vivant",
    artist: "Mira Solane",
    year: 2026,
    medium: "900 brass tiles and a camera that keeps nothing",
    note: "Lend it your reflection: nine hundred brass tiles tilt to draw you in light. Nothing is recorded, and the image never leaves your device.",
    gesture: "Lend your reflection",
  },
  ruban: {
    title: "Ruban",
    artist: "Aurèle Vasseur",
    year: 2022,
    medium: "Polished brass",
    note: "One strip of brass with a single twist: it has only one side. Follow its edge with your eyes and you come back reversed.",
    gesture: "Turn the ribbon",
  },
  equilibre: {
    title: "Équilibre",
    artist: "Lucia Ferrante",
    year: 2020,
    medium: "Carrara marble, brass",
    note: "A marble sphere resting on a brass point a few millimetres wide. Nudge it: it always finds its balance again.",
    gesture: "Nudge the sphere",
  },
  noeud: {
    title: "Nœud",
    artist: "Elias Morel",
    year: 2021,
    medium: "Mirror-polished steel",
    note: "A trefoil knot, the simplest knot that cannot be undone. Touch it and it ties itself anew, with five lobes.",
    gesture: "Retie the knot",
  },
  monolithe: {
    title: "Monolithe",
    artist: "Noa Hirata",
    year: 2024,
    medium: "Basalt and gold",
    note: "A basalt slab, split and mended with gold, after the Japanese art of kintsugi.",
    gesture: "Let the gold flow",
  },
  "pluie-d-or": {
    title: "Pluie d'or",
    artist: "Studio Kaze",
    year: 2025,
    medium: "Kinetic installation, 96 brass drops",
    note: "Ninety-six brass drops trace waves, ripples and domes in the air. Walk beneath them: they rise to let you pass.",
    gesture: "Make it rain",
  },
  automates: {
    title: "Les Trois Automates",
    artist: "Compagnie Atlas",
    year: 2026,
    medium: "Mechanical ballet for three automatons, light and sound, 1 min 24",
    note: "A mechanical ballet in five acts. Sit facing the stage: the light will go down, and in the third act, they will follow you. Contains flashing lights.",
    gesture: "Begin the performance",
  },
};

export type WallSide = "left" | "right" | "back" | "front";

export type Artwork = Notice & {
  id: ArtworkId;
  kind: "wall" | "sculpture" | "installation" | "performance";
  /** Center of the work (wall works: on the wall's face; sculptures: on the plinth top), world meters. */
  center: [number, number, number];
  /** Direction the work faces, on the floor plan (unit). */
  facing: Vec2;
  /** Wall works: width and height (m). */
  size: [number, number];
  /** Where a visitor stands to look at it, on the floor plan. */
  viewpoint: Vec2;
};

/** Distance from a wall work at which it is viewed (m). */
const VIEW_DISTANCE = 1.7;

function wallPlacement(wall: WallSide, at: number): { center: [number, number, number]; facing: Vec2 } {
  const y = FLOOR_Y + GALLERY.workCenterY;
  const hw = GALLERY.halfWidth;
  switch (wall) {
    case "left":
      return { center: [-hw, y, at], facing: [1, 0] };
    case "right":
      return { center: [hw, y, at], facing: [-1, 0] };
    case "back":
      return { center: [at, y, GALLERY.zEnd], facing: [0, -1] };
    case "front":
      return { center: [at, y, GALLERY.zStart], facing: [0, 1] };
  }
}

export const ARTWORKS: readonly Artwork[] = [
  ...GALLERY.works.map((w): Artwork => {
    const id = w.id as ArtworkId;
    const { center, facing } = wallPlacement(w.wall as WallSide, w.at);
    return {
      ...NOTICES[id],
      id,
      kind: "wall",
      center,
      facing,
      size: [w.width, w.height],
      viewpoint: [center[0] + facing[0] * VIEW_DISTANCE, center[2] + facing[1] * VIEW_DISTANCE],
    };
  }),
  ...GALLERY.sculptures.map((s, i): Artwork => {
    const id = s as ArtworkId;
    const [x, z] = GALLERY.plinths[i];
    // Sculptures face the gallery's central aisle.
    const facing: Vec2 = [x < 0 ? 1 : -1, 0];
    return {
      ...NOTICES[id],
      id,
      kind: "sculpture",
      center: [x, FLOOR_Y + GALLERY.plinthHeight, z],
      facing,
      size: [0.5, 0.5],
      viewpoint: [x, z],
    };
  }),
  {
    ...NOTICES["pluie-d-or"],
    id: "pluie-d-or",
    kind: "installation",
    center: [GALLERY.rain.center[0], FLOOR_Y + 2.8, GALLERY.rain.center[1]],
    facing: [0, -1],
    size: [GALLERY.rain.cols * GALLERY.rain.spacing[0], GALLERY.rain.rows * GALLERY.rain.spacing[1]],
    viewpoint: [GALLERY.rain.center[0], GALLERY.rain.center[1]],
  },
  {
    ...NOTICES.automates,
    id: "automates",
    kind: "performance",
    center: [(GALLERY.stage.minX + GALLERY.stage.maxX) / 2, FLOOR_Y + GALLERY.stage.height, (GALLERY.stage.minZ + GALLERY.stage.maxZ) / 2],
    facing: [0, -1],
    size: [GALLERY.stage.maxX - GALLERY.stage.minX, GALLERY.stage.maxZ - GALLERY.stage.minZ],
    viewpoint: [GALLERY.audience[0], GALLERY.audience[1]],
  },
];

export const getArtwork = (id: string): Artwork | undefined => ARTWORKS.find((a) => a.id === id);

/** Within this distance of a work's viewpoint (or a plinth's center), its label is shown (m). */
export const ARTWORK_RADIUS = 1.35;

/** The work the visitor is looking at, from where they stand: the nearest viewpoint within reach. */
export function nearestArtwork(position: Vec2, radius = ARTWORK_RADIUS): Artwork | null {
  let best: Artwork | null = null;
  let bestD = radius;
  for (const a of ARTWORKS) {
    const d = Math.hypot(a.viewpoint[0] - position[0], a.viewpoint[1] - position[1]);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/** True when a floor point is inside the gallery (past the entrance wall). */
export const inGallery = (p: Vec2) => p[1] > GALLERY.zStart - GALLERY.wall / 2;
