import type {
  AnimationSchema,
  ValidationResult,
  ValidationMessage,
} from '../types/schema'
import { MAX_FRAMES, DEFAULT_CAMERA_ID, SUPPORTED_EASINGS } from '../types/schema'
import { translate, type I18nParams, type MessageKey } from '../i18n'

const ARGB_RE = /^#[0-9A-Fa-f]{8}$/

function validationMessage(
  severity: ValidationMessage['severity'],
  messageKey: MessageKey,
  params?: I18nParams,
): ValidationMessage {
  return {
    severity,
    messageKey,
    params,
    message: translate(messageKey, params),
  }
}

export function validate(data: unknown): ValidationResult {
  const msgs: ValidationMessage[] = []

  // ── 型チェック ────────────────────────────────────────────────
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { valid: false, messages: [validationMessage('error', 'validation.rootObject')] }
  }
  const root = data as Record<string, unknown>

  // ── metadata ─────────────────────────────────────────────────
  if (!root.metadata || typeof root.metadata !== 'object') {
    msgs.push(validationMessage('error', 'validation.metadataMissing'))
    return { valid: false, messages: msgs }
  }
  const meta = root.metadata as Record<string, unknown>

  const requiredMeta: string[] = ['format_version', 'mc_version', 'resolution', 'fps', 'ticks_per_second', 'duration_ticks']
  for (const key of requiredMeta) {
    if (meta[key] === undefined) {
      msgs.push(validationMessage('error', 'validation.metadataKeyMissing', { key }))
    }
  }

  if (
    !Array.isArray(meta.resolution) ||
    meta.resolution.length !== 2 ||
    typeof meta.resolution[0] !== 'number' ||
    typeof meta.resolution[1] !== 'number'
  ) {
    msgs.push(validationMessage('error', 'validation.resolutionInvalid'))
  }

  if (meta.background_color !== undefined) {
    if (typeof meta.background_color !== 'string' || !ARGB_RE.test(meta.background_color)) {
      msgs.push(validationMessage('error', 'validation.backgroundColorInvalid'))
    }
  }

  if (meta.gizmo !== undefined) {
    if (typeof meta.gizmo !== 'object' || meta.gizmo === null || Array.isArray(meta.gizmo)) {
      msgs.push(validationMessage('error', 'validation.gizmoInvalid'))
    } else {
      const gizmo = meta.gizmo as Record<string, unknown>
      if (typeof gizmo.visible !== 'boolean') {
        msgs.push(validationMessage('error', 'validation.gizmoVisibleInvalid'))
      }
      if (
        !Array.isArray(gizmo.origin) ||
        gizmo.origin.length !== 2 ||
        typeof gizmo.origin[0] !== 'number' ||
        typeof gizmo.origin[1] !== 'number' ||
        !Number.isFinite(gizmo.origin[0]) ||
        !Number.isFinite(gizmo.origin[1])
      ) {
        msgs.push(validationMessage('error', 'validation.gizmoOriginInvalid'))
      }
    }
  }

  // フレーム数上限チェック
  const fps = typeof meta.fps === 'number' ? meta.fps : 0
  const tps = typeof meta.ticks_per_second === 'number' ? meta.ticks_per_second : 20
  const durationTicks = typeof meta.duration_ticks === 'number' ? meta.duration_ticks : 0
  if (fps > 0 && tps > 0 && durationTicks > 0) {
    const totalFrames = Math.ceil(durationTicks * fps / tps)
    if (totalFrames > MAX_FRAMES) {
      msgs.push(validationMessage('error', 'validation.frameLimitExceeded', {
        totalFrames,
        maxFrames: MAX_FRAMES,
      }))
    }
  }

  // ── objects ───────────────────────────────────────────────────
  if (!Array.isArray(root.objects)) {
    msgs.push(validationMessage('error', 'validation.objectsArray'))
    return { valid: false, messages: msgs }
  }

  const objects = root.objects as Record<string, unknown>[]
  const ids = new Set<string>()
  const cameraIds: string[] = []

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i]
    const prefix = `objects[${i}]`

    if (typeof obj.id !== 'string' || obj.id.trim() === '') {
      msgs.push(validationMessage('error', 'validation.objectIdMissing', { prefix }))
      continue
    }
    const id = obj.id as string
    if (ids.has(id)) {
      msgs.push(validationMessage('error', 'validation.objectIdDuplicate', { id }))
    }
    ids.add(id)

    if (obj.type !== 'block' && obj.type !== 'camera') {
      msgs.push(validationMessage('error', 'validation.objectTypeInvalid', { id }))
      continue
    }

    if (obj.type === 'camera') cameraIds.push(id)

    if (!Array.isArray(obj.keyframes) || obj.keyframes.length === 0) {
      msgs.push(validationMessage('error', 'validation.keyframesMissing', { id }))
    } else {
      for (let k = 0; k < obj.keyframes.length; k++) {
        const kf = obj.keyframes[k]
        if (typeof kf !== 'object' || kf === null || Array.isArray(kf)) continue
        const keyframe = kf as Record<string, unknown>
        const easing = keyframe.easing
        if (
          easing !== undefined &&
          (typeof easing !== 'string' || !(SUPPORTED_EASINGS as readonly string[]).includes(easing))
        ) {
          msgs.push(validationMessage('error', 'validation.easingInvalid', {
            id,
            index: k,
            easings: SUPPORTED_EASINGS.join(', '),
          }))
        }
        if (obj.type === 'block' && keyframe.multiplier !== undefined) {
          const multiplier = keyframe.multiplier
          if (typeof multiplier !== 'number' || !Number.isFinite(multiplier) || multiplier < 0) {
            msgs.push(validationMessage('error', 'validation.multiplierInvalid', {
              id,
              index: k,
            }))
          }
        }
      }
    }
  }

  // active_camera チェック
  if (msgs.filter(m => m.severity === 'error').length === 0) {
    const activeCam = typeof meta.active_camera === 'string'
      ? meta.active_camera
      : DEFAULT_CAMERA_ID

    if (cameraIds.length > 0 && !ids.has(activeCam)) {
      msgs.push(validationMessage('error', 'validation.activeCameraMissing', { activeCam }))
    } else if (cameraIds.length === 0) {
      msgs.push(validationMessage('warning', 'validation.noCamera'))
    } else if (!meta.active_camera && !ids.has(DEFAULT_CAMERA_ID)) {
      msgs.push(validationMessage('warning', 'validation.defaultCameraMissing', {
        defaultCameraId: DEFAULT_CAMERA_ID,
      }))
    }
  }

  const hasErrors = msgs.some(m => m.severity === 'error')
  return { valid: !hasErrors, messages: msgs }
}

export function parseSchema(data: unknown): AnimationSchema {
  return data as AnimationSchema
}
