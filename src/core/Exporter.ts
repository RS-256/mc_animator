import JSZip from 'jszip'
import type { AnimationSchema } from '../types/schema'
import type { SceneRenderer } from './Renderer'

export type ExportFormat = 'png_zip'

export interface ExportOptions {
  format: ExportFormat
  onProgress?: (current: number, total: number) => void
  onCancel?: () => boolean
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

  for (let frame = 0; frame < totalFrames; frame++) {
    if (options.onCancel?.()) return

    const tick = frame * ticksPerFrame
    const blob = await renderer.renderFrameBlob(tick)

    const frameNum = String(frame + 1).padStart(4, '0')
    zip.file(`frame_${frameNum}.png`, blob)

    options.onProgress?.(frame + 1, totalFrames)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mc_animator_export.zip'
  a.click()
  URL.revokeObjectURL(url)
}
