import type {
  AnimationSchema,
  ValidationResult,
  ValidationMessage,
} from '../types/schema'
import { MAX_FRAMES, DEFAULT_CAMERA_ID } from '../types/schema'

const ARGB_RE = /^#[0-9A-Fa-f]{8}$/

export function validate(data: unknown): ValidationResult {
  const msgs: ValidationMessage[] = []

  // ── 型チェック ────────────────────────────────────────────────
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { valid: false, messages: [{ severity: 'error', message: 'JSONのルートはオブジェクトである必要があります' }] }
  }
  const root = data as Record<string, unknown>

  // ── metadata ─────────────────────────────────────────────────
  if (!root.metadata || typeof root.metadata !== 'object') {
    msgs.push({ severity: 'error', message: 'metadata フィールドがありません' })
    return { valid: false, messages: msgs }
  }
  const meta = root.metadata as Record<string, unknown>

  const requiredMeta: string[] = ['format_version', 'mc_version', 'resolution', 'fps', 'ticks_per_second', 'duration_ticks']
  for (const key of requiredMeta) {
    if (meta[key] === undefined) {
      msgs.push({ severity: 'error', message: `metadata.${key} が見つかりません` })
    }
  }

  if (
    !Array.isArray(meta.resolution) ||
    meta.resolution.length !== 2 ||
    typeof meta.resolution[0] !== 'number' ||
    typeof meta.resolution[1] !== 'number'
  ) {
    msgs.push({ severity: 'error', message: 'metadata.resolution は [width, height] の数値配列である必要があります' })
  }

  if (meta.background_color !== undefined) {
    if (typeof meta.background_color !== 'string' || !ARGB_RE.test(meta.background_color)) {
      msgs.push({ severity: 'error', message: 'background_color は #AARRGGBB 形式で指定してください（例: #FF1A1A2E）' })
    }
  }

  // フレーム数上限チェック
  const fps = typeof meta.fps === 'number' ? meta.fps : 0
  const tps = typeof meta.ticks_per_second === 'number' ? meta.ticks_per_second : 20
  const durationTicks = typeof meta.duration_ticks === 'number' ? meta.duration_ticks : 0
  if (fps > 0 && tps > 0 && durationTicks > 0) {
    const totalFrames = Math.ceil(durationTicks * fps / tps)
    if (totalFrames > MAX_FRAMES) {
      msgs.push({
        severity: 'error',
        message: `フレーム数 ${totalFrames} は上限 ${MAX_FRAMES} を超えています（duration_ticks または fps を下げてください）`,
      })
    }
  }

  // ── objects ───────────────────────────────────────────────────
  if (!Array.isArray(root.objects)) {
    msgs.push({ severity: 'error', message: 'objects フィールドは配列である必要があります' })
    return { valid: false, messages: msgs }
  }

  const objects = root.objects as Record<string, unknown>[]
  const ids = new Set<string>()
  const cameraIds: string[] = []

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i]
    const prefix = `objects[${i}]`

    if (typeof obj.id !== 'string' || obj.id.trim() === '') {
      msgs.push({ severity: 'error', message: `${prefix}.id が未定義または空文字です` })
      continue
    }
    const id = obj.id as string
    if (ids.has(id)) {
      msgs.push({ severity: 'error', message: `id "${id}" が重複しています` })
    }
    ids.add(id)

    if (obj.type !== 'block' && obj.type !== 'camera') {
      msgs.push({ severity: 'error', message: `"${id}": type は "block" または "camera" である必要があります` })
      continue
    }

    if (obj.type === 'camera') cameraIds.push(id)

    if (!Array.isArray(obj.keyframes) || obj.keyframes.length === 0) {
      msgs.push({ severity: 'error', message: `オブジェクト "${id}" にキーフレームがありません` })
    }
  }

  // active_camera チェック
  if (msgs.filter(m => m.severity === 'error').length === 0) {
    const activeCam = typeof meta.active_camera === 'string'
      ? meta.active_camera
      : DEFAULT_CAMERA_ID

    if (cameraIds.length > 0 && !ids.has(activeCam)) {
      msgs.push({
        severity: 'error',
        message: `active_camera "${activeCam}" が objects に見つかりません`,
      })
    } else if (cameraIds.length === 0) {
      msgs.push({
        severity: 'warning',
        message: 'カメラオブジェクトが定義されていません。デフォルトカメラを使用します',
      })
    } else if (!meta.active_camera && !ids.has(DEFAULT_CAMERA_ID)) {
      msgs.push({
        severity: 'warning',
        message: `active_camera が未指定で "${DEFAULT_CAMERA_ID}" も見つかりません。最初のカメラを使用します`,
      })
    }
  }

  const hasErrors = msgs.some(m => m.severity === 'error')
  return { valid: !hasErrors, messages: msgs }
}

export function parseSchema(data: unknown): AnimationSchema {
  return data as AnimationSchema
}
