// Local paths for runtime assets served from /public (no external requests).
export const DRACO_DECODER_PATH = "/draco/";
export const MEDIAPIPE_WASM_PATH = "/mediapipe/wasm";
export const FACE_LANDMARKER_MODEL_PATH = "/mediapipe/face_landmarker.task";
export const HEAD_OCCLUDER_MODEL_PATH = "/models/head-occluder.glb";
export const SHOWROOM_MODEL_PATH = "/models/showroom.glb";
/**
 * Short looping face clip for demo mode (no webcam): runs through the same try-on pipeline.
 * See docs/demo-video.md. Missing file → "Demo video unavailable" error state.
 */
export const DEMO_VIDEO_PATH = "/demo/try-on-demo.mp4";
