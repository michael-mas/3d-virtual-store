# Demo-mode video

Demo mode (try-on without a webcam) plays `public/demo/try-on-demo.mp4` through the same
FaceLandmarker pipeline as the camera. The file is not in the repo yet; until it is added, choosing
"Use demo video" shows a "Demo video unavailable" message.

Recommended clip: 5–10 s, one face looking at the camera, slowly turning / tilting the head, even lighting,
no audio. Encode it as H.264 MP4 (plays everywhere, including iOS Safari), e.g.:

```bash
ffmpeg -i input.mov -t 8 -an -vf "scale=-2:720,fps=30" -c:v libx264 -profile:v main -pix_fmt yuv420p \
  -crf 26 -movflags +faststart public/demo/try-on-demo.mp4
```

Only use footage you have the rights to publish.
