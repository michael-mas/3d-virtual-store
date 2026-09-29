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

## README demo GIF

A short screen recording sells the project faster than any text. Record ~10 s of the app (e.g. glasses, then
lipstick, then face paint in try-on) with any screen recorder, then convert it to a small looping GIF:

```bash
ffmpeg -i recording.mov -vf "fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer" \
  -loop 0 docs/demo.gif
```

Keep it under ~5 MB (lower `fps` or the width if needed), then uncomment the `docs/demo.gif` line at the top of the
README.
