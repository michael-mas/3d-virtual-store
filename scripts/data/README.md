# Source data for generated models

- `canonical_face_model.obj` — MediaPipe canonical face mesh (468 vertices, centimeters), from
  https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj
  (Apache License 2.0). Converted by `scripts/generate-occluder.mjs` into `public/models/head-occluder.glb`.
- `geometry_pipeline_metadata_landmarks.pbtxt` — MediaPipe face geometry metadata, from
  https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/geometry_pipeline_metadata_landmarks.pbtxt
  (Apache License 2.0). Its `canonical_mesh` (468 vertices in landmark order with UVs, 898 triangles) is converted
  by `scripts/generate-face-mesh.mjs` into `lib/tryon/faceMeshTopology.json`, used by the surface try-on layer.
  Positions and triangles are identical to `canonical_face_model.obj`; its UVs are the OBJ's with v flipped.
