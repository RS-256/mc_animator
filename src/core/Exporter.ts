import JSZip from 'jszip'
import type { AnimationSchema } from '../types/schema'
import type { SceneRenderer } from './Renderer'

export type ExportFormat = 'png_zip' | 'mkv_ffv1' | 'mp4_h264' | 'mp4_h265'

export interface ExportOptions {
  format: ExportFormat
  onProgress?: (current: number, total: number) => void
  onCancel?: () => boolean
}

interface ExportPreset {
  label: string
  downloadName: string
  framePath: (frameNum: string) => string
  readme?: (fps: number) => string
  windowsScript?: (fps: number) => string
  unixScript?: (fps: number) => string
}

const VIDEO_INPUT_WINDOWS = 'frames\\frame_%%04d.png'
const VIDEO_INPUT_UNIX = 'frames/frame_%04d.png'

function buildPreset(format: ExportFormat): ExportPreset {
  switch (format) {
    case 'mkv_ffv1':
      return {
        label: 'Lossless MKV / FFV1',
        downloadName: 'mc_animator_mkv_ffv1_package.zip',
        framePath: frameNum => `frames/frame_${frameNum}.png`,
        readme: fps => videoReadme('Lossless MKV / FFV1', fps, 'output_lossless.mkv'),
        windowsScript: fps => [
          '@echo off',
          'setlocal',
          `ffmpeg -framerate ${fps} -i "${VIDEO_INPUT_WINDOWS}" -c:v ffv1 -level 3 -pix_fmt rgba "output_lossless.mkv"`,
          'pause',
        ].join('\r\n'),
        unixScript: fps => [
          '#!/usr/bin/env sh',
          'set -eu',
          `ffmpeg -framerate ${fps} -i "${VIDEO_INPUT_UNIX}" -c:v ffv1 -level 3 -pix_fmt rgba "output_lossless.mkv"`,
        ].join('\n'),
      }
    case 'mp4_h264':
      return {
        label: 'MP4 / H.264',
        downloadName: 'mc_animator_mp4_h264_package.zip',
        framePath: frameNum => `frames/frame_${frameNum}.png`,
        readme: fps => videoReadme('MP4 / H.264', fps, 'output_h264.mp4'),
        windowsScript: fps => [
          '@echo off',
          'setlocal',
          `ffmpeg -framerate ${fps} -i "${VIDEO_INPUT_WINDOWS}" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "output_h264.mp4"`,
          'pause',
        ].join('\r\n'),
        unixScript: fps => [
          '#!/usr/bin/env sh',
          'set -eu',
          `ffmpeg -framerate ${fps} -i "${VIDEO_INPUT_UNIX}" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "output_h264.mp4"`,
        ].join('\n'),
      }
    case 'mp4_h265':
      return {
        label: 'MP4 / H.265',
        downloadName: 'mc_animator_mp4_h265_package.zip',
        framePath: frameNum => `frames/frame_${frameNum}.png`,
        readme: fps => videoReadme('MP4 / H.265', fps, 'output_h265.mp4'),
        windowsScript: fps => [
          '@echo off',
          'setlocal',
          `ffmpeg -framerate ${fps} -i "${VIDEO_INPUT_WINDOWS}" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx265 -preset slow -crf 20 -tag:v hvc1 -pix_fmt yuv420p "output_h265.mp4"`,
          'pause',
        ].join('\r\n'),
        unixScript: fps => [
          '#!/usr/bin/env sh',
          'set -eu',
          `ffmpeg -framerate ${fps} -i "${VIDEO_INPUT_UNIX}" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx265 -preset slow -crf 20 -tag:v hvc1 -pix_fmt yuv420p "output_h265.mp4"`,
        ].join('\n'),
      }
    case 'png_zip':
    default:
      return {
        label: 'PNG sequence',
        downloadName: 'mc_animator_png_sequence.zip',
        framePath: frameNum => `frame_${frameNum}.png`,
      }
  }
}

function videoReadme(label: string, fps: number, outputName: string): string {
  return [
    `# ${label}`,
    '',
    'This package contains a PNG frame sequence rendered by mc_animator.',
    'Video encoding can be heavy in a browser, so this package keeps the source frames and provides local ffmpeg scripts.',
    '',
    '## Requirements',
    '',
    '- Install ffmpeg and make sure the `ffmpeg` command is available in your terminal.',
    '',
    '## Encode locally',
    '',
    '- Windows: run `encode_windows.bat`.',
    '- macOS / Linux: run `sh encode_unix.sh`.',
    '',
    'Equivalent command:',
    '',
    `ffmpeg -framerate ${fps} -i "frames/frame_%04d.png" ${ffmpegArgsForReadme(label)} "${outputName}"`,
    '',
    '## Notes',
    '',
    '- The PNG frames are the lossless source. Keep them if you may re-encode later.',
    '- FFV1/MKV is intended for lossless archival output.',
    '- H.264/H.265 MP4 outputs are practical delivery formats and do not preserve alpha transparency.',
  ].join('\n')
}

function ffmpegArgsForReadme(label: string): string {
  if (label.includes('FFV1')) return '-c:v ffv1 -level 3 -pix_fmt rgba'
  if (label.includes('H.265')) {
    return '-vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx265 -preset slow -crf 20 -tag:v hvc1 -pix_fmt yuv420p'
  }
  return '-vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p'
}

export async function exportAnimation(
  schema: AnimationSchema,
  renderer: SceneRenderer,
  options: ExportOptions,
): Promise<void> {
  const { fps, ticks_per_second, duration_ticks } = schema.metadata
  const totalFrames = Math.ceil(duration_ticks * fps / ticks_per_second)
  const ticksPerFrame = ticks_per_second / fps

  const zip = new JSZip()
  const preset = buildPreset(options.format)

  for (let frame = 0; frame < totalFrames; frame++) {
    if (options.onCancel?.()) return

    const tick = frame * ticksPerFrame
    const blob = await renderer.renderFrameBlob(tick)

    const frameNum = String(frame + 1).padStart(4, '0')
    zip.file(preset.framePath(frameNum), blob)

    options.onProgress?.(frame + 1, totalFrames)
  }

  if (preset.readme) zip.file('README.txt', preset.readme(fps))
  if (preset.windowsScript) zip.file('encode_windows.bat', preset.windowsScript(fps))
  if (preset.unixScript) zip.file('encode_unix.sh', preset.unixScript(fps))

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = preset.downloadName
  a.click()
  URL.revokeObjectURL(url)
}
