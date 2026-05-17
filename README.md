# mc_animator

Minecraft-style animation renderer built with Vue, TypeScript, Vite, and Three.js.

## Export formats

The app renders frames in the browser as PNG images. PNG frames are kept as the lossless source. H.264/H.265/AV1 MP4 exports use WebCodecs when available, while lossless MKV/FFV1 export uses ffmpeg.wasm.

- PNG sequence + ZIP
- Lossless MKV / FFV1
- MP4 / H.264
- MP4 / H.265
- MP4 / AV1

Browser video encoding is CPU and memory heavy. If a browser export is too slow or unsupported, export the PNG sequence and encode it locally with ffmpeg.
Browser H.264/H.265/AV1 export requires WebCodecs support, which is best in Chromium-based browsers. H.265 and AV1 support are more OS/GPU dependent than H.264. The bundled ffmpeg.wasm core does not include a practical AV1 encoder, so AV1 direct export uses WebCodecs. Local ffmpeg commands below use slower presets for better compression.

For video formats, the arrow beside the render button lets you choose between:

- Direct video download
- PNG sequence package with `encode_windows.bat`, `encode_unix.sh`, and `README.txt`

PNG sequence exports contain:

```text
frame_0001.png
frame_0002.png
...
```

## Easing

Keyframes can define `easing` to control how interpolated values move into that keyframe. The easing belongs to the destination keyframe, so this example uses `easeInOutCubic` for the movement from tick `0` to tick `60`:

```json
{
  "keyframes": [
    { "tick": 0, "pos": [0, 0, 0] },
    { "tick": 60, "pos": [0, 4, 0], "easing": "easeInOutCubic" }
  ]
}
```

Supported easing values:

- `linear`
- `easeInOutCubic`
- `easeInOutQuart`
- `easeInOutSine`
- `easeInOutExpo`

Easing is applied to block `pos` interpolation and camera `pos`, `look_at`, and `fov` interpolation. Keyframes without `easing` use `linear`.

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

MP4 / AV1:

```bash
ffmpeg -framerate 30 -i "frames/frame_%04d.png" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libaom-av1 -crf 30 -b:v 0 -cpu-used 4 -pix_fmt yuv420p "output_av1.mp4"
```

Replace `30` with the animation FPS when needed.

Notes:

- FFV1/MKV is intended for lossless archival output.
- H.264/H.265/AV1 MP4 outputs are practical delivery formats and do not preserve alpha transparency.
- AV1 local encoding requires an ffmpeg build with an AV1 encoder such as `libaom-av1`.
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
