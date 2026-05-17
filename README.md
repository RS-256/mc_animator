# mc_animator

Minecraft-style animation renderer built with Vue, TypeScript, Vite, and Three.js.

## Export formats

The app renders frames in the browser as PNG images. PNG frames are kept as the lossless source, and video-oriented export options include local ffmpeg scripts so encoding can be done outside the browser when it is heavy.

- PNG sequence + ZIP
- Lossless MKV / FFV1 conversion package
- MP4 / H.264 conversion package
- MP4 / H.265 conversion package

Video conversion packages contain:

```text
frames/
  frame_0001.png
  frame_0002.png
  ...
README.txt
encode_windows.bat
encode_unix.sh
```

## Local video encoding

Install ffmpeg and make sure the `ffmpeg` command is available in your terminal.

Lossless MKV / FFV1:

```bash
ffmpeg -framerate 30 -i "frames/frame_%04d.png" -c:v ffv1 -level 3 -pix_fmt rgba "output_lossless.mkv"
```

MP4 / H.264:

```bash
ffmpeg -framerate 30 -i "frames/frame_%04d.png" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "output_h264.mp4"
```

MP4 / H.265:

```bash
ffmpeg -framerate 30 -i "frames/frame_%04d.png" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx265 -preset slow -crf 20 -tag:v hvc1 -pix_fmt yuv420p "output_h265.mp4"
```

Replace `30` with the animation FPS when needed. The generated package scripts already use the FPS from the loaded animation schema.

Notes:

- FFV1/MKV is intended for lossless archival output.
- H.264/H.265 MP4 outputs are practical delivery formats and do not preserve alpha transparency.
- Keep the PNG sequence if you may re-encode later.

## Development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```
