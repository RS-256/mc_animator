// MC Animator — JSON Schema Types
import type { I18nParams, MessageKey } from '../i18n'

export type TickMode = 'absolute' | 'relative'
export const SUPPORTED_EASINGS = [
  'linear',
  'easeInOutCubic',
  'easeInOutQuart',
  'easeInOutSine',
  'easeInOutExpo',
] as const
export type EasingType = typeof SUPPORTED_EASINGS[number]
export const SUPPORTED_CAMERA_PATHS = [
  'linear',
  'bezier',
] as const
export type CameraPathType = typeof SUPPORTED_CAMERA_PATHS[number]

export interface BlockState {
  [key: string]: string
}

export type Vec3 = [number, number, number]
export type CameraPositionComponent = number | string
export type CameraPosition = [
  CameraPositionComponent,
  CameraPositionComponent,
  CameraPositionComponent,
]

// ブロックキーフレーム
export interface BlockKeyframe {
  tick: number
  tick_mode?: TickMode          // デフォルト: 'absolute'
  block?: string | null         // null で削除
  state?: BlockState
  pos?: Vec3
  multiplier?: number           // ブロック一辺の倍率。デフォルト: 1
  easing?: EasingType
}

// カメラキーフレーム
export interface CameraKeyframe {
  tick: number
  tick_mode?: TickMode
  pos?: CameraPosition
  look_at?: Vec3
  fov?: number
  easing?: EasingType
  path?: CameraPathType          // 前のキーフレームからこのキーフレームまでの pos 補間
}

// ブロックオブジェクト
export interface BlockObject {
  id: string
  type: 'block'
  keyframes: BlockKeyframe[]
}

// カメラオブジェクト
export interface CameraObject {
  id: string
  type: 'camera'
  keyframes: CameraKeyframe[]
}

export type SceneObject = BlockObject | CameraObject

// metadata
export interface Metadata {
  format_version: number
  mc_version: string
  resolution: [number, number] | readonly [number, number]
  fps: number
  ticks_per_second: number
  duration_ticks: number
  background_color?: string     // '#AARRGGBB' 形式、デフォルト '#00000000'
  active_camera?: string        // デフォルト '__camera__'
  gizmo?: GizmoSettings         // プレビューUI専用。レンダリング出力には含めない
}

export interface GizmoSettings {
  visible: boolean
  origin: [number, number]
}

// ルートスキーマ
export interface AnimationSchema {
  metadata: Metadata
  objects: SceneObject[]
}

// ── バリデーション結果 ──────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationMessage {
  severity: ValidationSeverity
  messageKey?: MessageKey
  params?: I18nParams
  message: string
}

export interface ValidationResult {
  valid: boolean
  messages: ValidationMessage[]
}

// ── 補間済みフレーム状態（内部用） ────────────────────────────────

export interface ResolvedBlockState {
  visible: boolean
  block: string
  state: BlockState
  pos: Vec3
  multiplier: number
}

export interface ResolvedCameraState {
  pos: Vec3
  look_at: Vec3
  fov: number
}

export const MAX_FRAMES = 4096
export const DEFAULT_CAMERA_ID = '__camera__'
export const DEFAULT_BACKGROUND_COLOR = '#00000000'
