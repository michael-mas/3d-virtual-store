# Demo-mode video

Demo mode (try-on without a webcam) plays a short looping clip through the same FaceLandmarker pipeline as
the camera. Files (served from `public/demo/`, picked with `canPlayType`, see `DEMO_VIDEO_SOURCES` in
`lib/assets.ts`):

- `try-on-demo.mp4` — H.264 Main, 720p, 30 fps, no audio (plays everywhere, including iOS Safari)
- `try-on-demo.webm` — VP9 fallback for browsers built without H.264 (e.g. some Chromium builds)

If neither can be played, choosing "Use demo video" shows a "Demo video unavailable" message.

To replace the clip (5–10 s, one face looking at the camera and turning slightly, even lighting):

```bash
ffmpeg -i input.mov -an -vf "scale=-2:720,fps=30" -c:v libx264 -profile:v main -pix_fmt yuv420p \
  -crf 27 -preset slow -movflags +faststart public/demo/try-on-demo.mp4
ffmpeg -i input.mov -an -vf "scale=-2:720,fps=30" -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 \
  public/demo/try-on-demo.webm
```

Only use footage you have the rights to publish.
