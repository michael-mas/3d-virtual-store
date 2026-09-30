# Demo-mode video (optional)

Demo mode lets visitors without a webcam try products on a looping face clip, run through the same FaceLandmarker
pipeline as the camera. No clip is bundled, so the option is hidden. To enable it:

1. Add a 5–10 s clip of one face looking at the camera and turning slightly, in even lighting, as
   `public/demo/try-on-demo.mp4` (H.264, plays everywhere including iOS Safari) and `public/demo/try-on-demo.webm`
   (VP9, for Chromium builds without H.264):

   ```bash
   ffmpeg -i input.mov -an -vf "scale=-2:720,fps=30" -c:v libx264 -profile:v main -pix_fmt yuv420p \
     -crf 27 -preset slow -movflags +faststart public/demo/try-on-demo.mp4
   ffmpeg -i input.mov -an -vf "scale=-2:720,fps=30" -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 \
     public/demo/try-on-demo.webm
   ```

2. List them in `DEMO_VIDEO_SOURCES` (`lib/assets.ts`):

   ```ts
   export const DEMO_VIDEO_SOURCES = [
     { src: "/demo/try-on-demo.mp4", type: 'video/mp4; codecs="avc1.4D401F"' },
     { src: "/demo/try-on-demo.webm", type: 'video/webm; codecs="vp9"' },
   ];
   ```

Camera errors then offer "Use demo video". Only use footage you have the rights to publish.

## README demo GIF

A short screen recording sells the project faster than any text. Record ~10 s of the app (e.g. glasses, then
lipstick, then face paint in try-on) with any screen recorder, then convert it to a small looping GIF:

```bash
ffmpeg -i recording.mov -vf "fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer" \
  -loop 0 docs/demo.gif
```

Keep it under ~5 MB (lower `fps` or the width if needed) and save it as `docs/demo.gif`. The current GIF shows no
real face: makeup is previewed on the procedural mannequin head.
