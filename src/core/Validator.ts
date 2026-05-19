import type {
  AnimationSchema,
  ValidationResult,
  ValidationMessage,
} from '../types/schema'
import { MAX_FRAMES, DEFAULT_CAMERA_ID, SUPPORTED_EASINGS } from '../types/schema'
import { translate, type I18nParams, type MessageKey } from '../i18n'

const ARGB_RE = /^#[0-9A-Fa-f]{8}$/
const RELATIVE_POS_RE = /^~(?:[+-]?(?:\d+\.?\d*|\.\d+))?$/

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

  for (const key of ['format_version', 'fps', 'ticks_per_second', 'duration_ticks']) {
    if (meta[key] !== undefined && !isFiniteNumber(meta[key])) {
      msgs.push(validationMessage('error', 'validation.metadataNumberInvalid', { key }))
    }
  }

  if (meta.mc_version !== undefined && typeof meta.mc_version !== 'string') {
    msgs.push(validationMessage('error', 'validation.mcVersionInvalid'))
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

  const objects = root.objects as unknown[]
  const ids = new Set<string>()
  const cameraIds: string[] = []

  for (let i = 0; i < objects.length; i++) {
    const prefix = `objects[${i}]`
    const rawObj = objects[i]

    if (typeof rawObj !== 'object' || rawObj === null || Array.isArray(rawObj)) {
      msgs.push(validationMessage('error', 'validation.objectInvalid', { index: i }))
      continue
    }

    const obj = rawObj as Record<string, unknown>

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
        if (typeof kf !== 'object' || kf === null || Array.isArray(kf)) {
          msgs.push(validationMessage('error', 'validation.keyframeInvalid', { id, index: k }))
          continue
        }
        const keyframe = kf as Record<string, unknown>

        if (!isFiniteNumber(keyframe.tick)) {
          msgs.push(validationMessage('error', 'validation.tickInvalid', { id, index: k }))
        }

        if (
          keyframe.tick_mode !== undefined &&
          keyframe.tick_mode !== 'absolute' &&
          keyframe.tick_mode !== 'relative'
        ) {
          msgs.push(validationMessage('error', 'validation.tickModeInvalid', { id, index: k }))
        }

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

        if (obj.type === 'block' && keyframe.pos !== undefined && !isNumberVec3(keyframe.pos)) {
          msgs.push(validationMessage('error', 'validation.blockPosInvalid', { id, index: k }))
        }

        if (obj.type === 'camera') {
          if (keyframe.pos !== undefined && !isCameraPos(keyframe.pos)) {
            msgs.push(validationMessage('error', 'validation.cameraPosInvalid', { id, index: k }))
          }
          if (keyframe.look_at !== undefined && !isNumberVec3(keyframe.look_at)) {
            msgs.push(validationMessage('error', 'validation.cameraLookAtInvalid', { id, index: k }))
          }
          if (keyframe.fov !== undefined && (!isFiniteNumber(keyframe.fov) || keyframe.fov <= 0)) {
            msgs.push(validationMessage('error', 'validation.cameraFovInvalid', { id, index: k }))
          }
        }
      }

      if (obj.type === 'camera') {
        validateCameraRelativePositions(id, obj.keyframes, msgs)
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNumberVec3(value: unknown): value is [number, number, number] {
  return Array.isArray(value) &&
    value.length === 3 &&
    value.every(isFiniteNumber)
}

function isRelativePosComponent(value: unknown): value is string {
  return typeof value === 'string' && RELATIVE_POS_RE.test(value)
}

function isCameraPos(value: unknown): value is [number | string, number | string, number | string] {
  return Array.isArray(value) &&
    value.length === 3 &&
    value.every(component => isFiniteNumber(component) || isRelativePosComponent(component))
}

function hasRelativeComponent(value: unknown): boolean {
  return Array.isArray(value) && value.some(component => typeof component === 'string' && component.startsWith('~'))
}

function validateCameraRelativePositions(
  id: string,
  rawKeyframes: unknown,
  msgs: ValidationMessage[],
) {
  if (!Array.isArray(rawKeyframes)) return

  let lastAbsoluteTick = 0
  let hasPreviousPos = false

  const keyframes = rawKeyframes
    .map((kf, index) => {
      if (typeof kf !== 'object' || kf === null || Array.isArray(kf)) return null
      const keyframe = kf as Record<string, unknown>
      if (!isFiniteNumber(keyframe.tick)) return null
      const absoluteTick = keyframe.tick_mode === 'relative'
        ? lastAbsoluteTick + keyframe.tick
        : keyframe.tick
      lastAbsoluteTick = absoluteTick
      return { index, absoluteTick, keyframe }
    })
    .filter((kf): kf is NonNullable<typeof kf> => kf !== null)
    .sort((a, b) => a.absoluteTick - b.absoluteTick)

  for (const { index, keyframe } of keyframes) {
    if (keyframe.pos === undefined) continue
    if (!isCameraPos(keyframe.pos)) continue

    if (hasRelativeComponent(keyframe.pos) && !hasPreviousPos) {
      msgs.push(validationMessage('error', 'validation.cameraRelativePosWithoutPrevious', { id, index }))
      continue
    }

    hasPreviousPos = true
  }
}

export function parseSchema(data: unknown): AnimationSchema {
  return data as AnimationSchema
}
