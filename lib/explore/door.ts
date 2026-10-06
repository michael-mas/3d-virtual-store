import { DOOR_CENTER, DOOR_OBSTACLE, GALLERY, OBSTACLES, type Obstacle, type Vec2 } from "./layout";

/**
 * The gallery door, two glazed leaves that slide into the wall: 0 closed … 1 open. It opens as the visitor or the
 * concierge comes near (or as a walk leads through it), closes behind them, and blocks the doorway until it is
 * mostly open. Advanced every frame by the Gallery component.
 */
export const door = { amount: 0 };

/** Open enough to walk through. */
export const DOOR_PASSABLE = 0.7;
/** Someone within this distance of the doorway opens the door (m). */
export const DOOR_SENSOR = 2.1;
/** Opening / closing speed (amount per second). */
const DOOR_SPEED = 1.1;

const CLOSED: readonly Obstacle[] = [...OBSTACLES, DOOR_OBSTACLE];

/** The obstacles in force now (with the door across the doorway while it is closed). */
export const walkObstacles = (): readonly Obstacle[] => (door.amount >= DOOR_PASSABLE ? OBSTACLES : CLOSED);

/** Which side of the entrance wall a floor point is on: -1 salon, 1 gallery. */
export const sideOfDoor = (p: Vec2) => (p[1] < DOOR_CENTER[1] ? -1 : 1);

const nearDoor = (p: Vec2) => Math.hypot(p[0] - DOOR_CENTER[0], p[1] - DOOR_CENTER[1]) < DOOR_SENSOR;

/**
 * Should the door be open: someone stands near it, or a walk in progress crosses the doorway (planned with the door
 * open, see player.walkTo) and the walker is on its way there.
 */
export function doorWanted(walkers: readonly Vec2[], path: readonly Vec2[] = []): boolean {
  if (walkers.some(nearDoor)) return true;
  const from = walkers[0];
  if (!from || path.length === 0) return false;
  return path.some((p) => sideOfDoor(p) !== sideOfDoor(from)) && Math.abs(from[1] - DOOR_CENTER[1]) < DOOR_SENSOR + 2;
}

/** One frame of the door's motion toward open or closed (linear; the leaves ease it for display). */
export function stepDoor(wanted: boolean, dt: number) {
  const target = wanted ? 1 : 0;
  const step = DOOR_SPEED * dt;
  door.amount = Math.abs(target - door.amount) <= step ? target : door.amount + Math.sign(target - door.amount) * step;
}

/** Where to walk to reach `goal` when it is on the other side of the entrance wall: the doorway first. */
export function viaDoorway(from: Vec2, goal: Vec2, clearance: number): Vec2 {
  const side = sideOfDoor(from);
  if (side === sideOfDoor(goal)) return goal;
  const inLine = Math.abs(from[0] - DOOR_CENTER[0]) < GALLERY.door.halfWidth - clearance - 0.05;
  const close = Math.abs(from[1] - DOOR_CENTER[1]) < 0.75;
  // In front of the opening: go through it; else line up with it first.
  return inLine && close ? [DOOR_CENTER[0], DOOR_CENTER[1] - side * 0.8] : [DOOR_CENTER[0], DOOR_CENTER[1] + side * 0.7];
}
