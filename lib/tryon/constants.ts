/**
 * MediaPipe face geometry camera (mediapipe/tasks/cc/vision/face_geometry/face_geometry_from_landmarks_graph.cc):
 * perspective, vertical FOV 63°, near 1cm, far 100m; aspect = input frame aspect. Camera at the origin looking
 * down -Z, Y up (same convention as three.js). Canonical face / pose matrix units are centimeters.
 */
export const MEDIAPIPE_VERTICAL_FOV_DEG = 63;
/** Scene units are meters. */
export const CM = 0.01;
export const TRY_ON_NEAR = 1 * CM;
export const TRY_ON_FAR = 100;

/**
 * Where the glasses origin (bridge center, lens plane) sits in canonical face space (meters):
 * between the eyes (landmarks 33/133/263/362, y≈2.6cm) and in front of the nose bridge (landmark 168, z≈5.2cm).
 * Per-product calibration is applied on top.
 */
export const GLASSES_ANCHOR: [number, number, number] = [0, 2.6 * CM, 5.8 * CM];

/** Selfie-style mirroring of the try-on stage (video + 3D). Applied on screen and in captured photos. */
export const TRY_ON_MIRRORED = true;
