import type {
  AnimationSchema,
  BlockObject,
  CameraObject,
  BlockKeyframe,
  CameraKeyframe,
  ResolvedBlockState,
  ResolvedCameraState,
  BlockState,
  EasingType,
} from '../types/schema'
import { DEFAULT_CAMERA_ID } from '../types/schema'

// ── イージング ────────────────────────────────────────────────────

function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'linear':
    default:
      return t
  }
}

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpVec3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerpNumber(a[0], b[0], t), lerpNumber(a[1], b[1], t), lerpNumber(a[2], b[2], t)]
}

// ── tick_mode の解決（relative → absolute に変換） ─────────────────

function resolveAbsoluteTicks<T extends { tick: number; tick_mode?: string }>(
  keyframes: T[],
): (T & { _absoluteTick: number })[] {
  let lastAbsolute = 0
  return keyframes.map(kf => {
    const abs =
      kf.tick_mode === 'relative' ? lastAbsolute + kf.tick : kf.tick
    lastAbsolute = abs
    return { ...kf, _absoluteTick: abs }
  })
}

// ── ブロック補間 ──────────────────────────────────────────────────

export function resolveBlock(
  obj: BlockObject,
  tick: number,
): ResolvedBlockState | null {
  const kfs = resolveAbsoluteTicks(obj.keyframes as BlockKeyframe[])
    .sort((a, b) => a._absoluteTick - b._absoluteTick)

  if (kfs.length === 0 || tick < kfs[0]._absoluteTick) return null

  // 現在 tick より前または同じ最後のキーフレームを見つける
  let prevIdx = 0
  for (let i = 0; i < kfs.length; i++) {
    if (kfs[i]._absoluteTick <= tick) prevIdx = i
    else break
  }

  // 状態を先頭から prevIdx まで積み上げて解決
  let block: string | null = null
  let state: BlockState = {}
  let pos: [number, number, number] = [0, 0, 0]
  let easing: EasingType = 'linear'

  for (let i = 0; i <= prevIdx; i++) {
    const kf = kfs[i]
    if (kf.block !== undefined) block = kf.block
    if (kf.state !== undefined) state = { ...state, ...kf.state }
    if (kf.pos !== undefined) pos = kf.pos
    if (kf.easing !== undefined) easing = kf.easing
  }

  if (block === null) return null // 削除済み

  // pos の補間（次のキーフレームがあれば）
  const nextIdx = prevIdx + 1
  if (nextIdx < kfs.length) {
    const prev = kfs[prevIdx]
    const next = kfs[nextIdx]
    const prevPos = resolveFieldAt<[number, number, number]>(kfs, prevIdx, 'pos', [0, 0, 0])
    const nextPos = resolveFieldAt<[number, number, number]>(kfs, nextIdx, 'pos', prevPos)

    const duration = next._absoluteTick - prev._absoluteTick
    if (duration > 0) {
      const rawT = (tick - prev._absoluteTick) / duration
      const t = applyEasing(rawT, easing)
      pos = lerpVec3(prevPos, nextPos, t)
    }
  }

  return { visible: true, block, state, pos }
}

// キーフレーム配列からフィールドを遡って解決するヘルパー
function resolveFieldAt<T>(
  kfs: (BlockKeyframe & { _absoluteTick: number })[],
  upToIdx: number,
  field: keyof BlockKeyframe,
  defaultVal: T,
): T {
  for (let i = upToIdx; i >= 0; i--) {
    const val = (kfs[i] as unknown as Record<string, unknown>)[field as string]
    if (val !== undefined) return val as T
  }
  return defaultVal
}

// ── カメラ補間 ────────────────────────────────────────────────────

const DEFAULT_CAM: ResolvedCameraState = {
  pos: [10, 10, 10],
  look_at: [0, 0, 0],
  fov: 70,
}

export function resolveCamera(
  obj: CameraObject,
  tick: number,
): ResolvedCameraState {
  const kfs = resolveAbsoluteTicks(obj.keyframes as CameraKeyframe[])
    .sort((a, b) => a._absoluteTick - b._absoluteTick)

  if (kfs.length === 0) return DEFAULT_CAM

  // 最初のキーフレームより前は最初の値を使う
  if (tick <= kfs[0]._absoluteTick) {
    return {
      pos: kfs[0].pos ?? DEFAULT_CAM.pos,
      look_at: kfs[0].look_at ?? DEFAULT_CAM.look_at,
      fov: kfs[0].fov ?? DEFAULT_CAM.fov,
    }
  }

  // 最後のキーフレームより後は最後の値を使う
  const last = kfs[kfs.length - 1]
  if (tick >= last._absoluteTick) {
    const pos = resolveCamField<[number, number, number]>(kfs, kfs.length - 1, 'pos', DEFAULT_CAM.pos)
    const look_at = resolveCamField<[number, number, number]>(kfs, kfs.length - 1, 'look_at', DEFAULT_CAM.look_at)
    const fov = resolveCamField<number>(kfs, kfs.length - 1, 'fov', DEFAULT_CAM.fov)
    return { pos, look_at, fov }
  }

  // 補間
  let prevIdx = 0
  for (let i = 0; i < kfs.length - 1; i++) {
    if (kfs[i]._absoluteTick <= tick) prevIdx = i
  }
  const nextIdx = prevIdx + 1
  const prev = kfs[prevIdx]
  const next = kfs[nextIdx]
  const duration = next._absoluteTick - prev._absoluteTick
  const easing = resolveCamField<EasingType>(kfs, prevIdx, 'easing', 'linear')
  const rawT = duration > 0 ? (tick - prev._absoluteTick) / duration : 1
  const t = applyEasing(rawT, easing)

  const prevPos = resolveCamField<[number, number, number]>(kfs, prevIdx, 'pos', DEFAULT_CAM.pos)
  const nextPos = resolveCamField<[number, number, number]>(kfs, nextIdx, 'pos', prevPos)
  const prevLookAt = resolveCamField<[number, number, number]>(kfs, prevIdx, 'look_at', DEFAULT_CAM.look_at)
  const nextLookAt = resolveCamField<[number, number, number]>(kfs, nextIdx, 'look_at', prevLookAt)
  const prevFov = resolveCamField<number>(kfs, prevIdx, 'fov', DEFAULT_CAM.fov)
  const nextFov = resolveCamField<number>(kfs, nextIdx, 'fov', prevFov)

  return {
    pos: lerpVec3(prevPos, nextPos, t),
    look_at: lerpVec3(prevLookAt, nextLookAt, t),
    fov: lerpNumber(prevFov, nextFov, t),
  }
}

function resolveCamField<T>(
  kfs: (CameraKeyframe & { _absoluteTick: number })[],
  upToIdx: number,
  field: keyof CameraKeyframe,
  defaultVal: T,
): T {
  for (let i = upToIdx; i >= 0; i--) {
    const val = (kfs[i] as unknown as Record<string, unknown>)[field as string]
    if (val !== undefined) return val as T
  }
  return defaultVal
}

// ── シーン全体の解決 ──────────────────────────────────────────────

export interface ResolvedScene {
  blocks: Map<string, ResolvedBlockState>
  camera: ResolvedCameraState
}

export function resolveScene(schema: AnimationSchema, tick: number): ResolvedScene {
  const blocks = new Map<string, ResolvedBlockState>()

  // アクティブカメラの決定
  const activeCamId = schema.metadata.active_camera ?? DEFAULT_CAMERA_ID
  let activeCamObj: CameraObject | undefined

  for (const obj of schema.objects) {
    if (obj.type === 'block') {
      const resolved = resolveBlock(obj, tick)
      if (resolved) blocks.set(obj.id, resolved)
    } else if (obj.type === 'camera') {
      if (obj.id === activeCamId) activeCamObj = obj
      // active_camera 未指定 & __camera__ もない場合は最初のカメラ
      if (!activeCamObj && !schema.metadata.active_camera) activeCamObj = obj
    }
  }

  const camera = activeCamObj ? resolveCamera(activeCamObj, tick) : DEFAULT_CAM
  return { blocks, camera }
}
