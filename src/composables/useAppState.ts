import { ref, computed, readonly } from 'vue'
import type { AnimationSchema, ValidationResult } from '../types/schema'
import { validate, parseSchema } from '../core/Validator'
import { CdnTextureLoader, ZipTextureLoader } from '../texture/TextureLoader'
import { translate } from '../i18n'

// ── シングルトンの状態 ─────────────────────────────────────────────

const schema = ref<AnimationSchema | null>(null)
const validation = ref<ValidationResult | null>(null)
const currentTick = ref(0)
const isPlaying = ref(false)
const activeCameraId = ref<string>('__camera__')
const sourceJsonFileName = ref<string | null>(null)
const selectedObjectIds = ref<string[]>([])

const cdnLoader = new CdnTextureLoader('1.21.4')
const zipLoader = new ZipTextureLoader(cdnLoader)

// 出力パネル
const isExporting = ref(false)
const exportProgress = ref({ current: 0, total: 0 })

// ── 派生状態 ──────────────────────────────────────────────────────

const totalTicks = computed(() => schema.value?.metadata.duration_ticks ?? 0)

const fps = computed(() => schema.value?.metadata.fps ?? 60)
const tps = computed(() => schema.value?.metadata.ticks_per_second ?? 20)
const ticksPerFrame = computed(() => tps.value / fps.value)
const totalFrames = computed(() =>
  Math.ceil(totalTicks.value * fps.value / tps.value),
)

const cameraObjects = computed(() =>
  schema.value?.objects.filter(o => o.type === 'camera') ?? [],
)

const blockObjects = computed(() =>
  schema.value?.objects.filter(o => o.type === 'block') ?? [],
)

const selectedObjects = computed(() => {
  if (!schema.value) return []
  const selectedIds = new Set(selectedObjectIds.value)
  return schema.value.objects.filter(object => selectedIds.has(object.id))
})

// ── アクション ────────────────────────────────────────────────────

async function loadJson(file: File) {
  const text = await file.text()
  let data: unknown

  try {
    data = JSON.parse(text)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    validation.value = {
      valid: false,
      messages: [{
        severity: 'error',
        messageKey: 'validation.parseError',
        params: { detail },
        message: translate('validation.parseError', { detail }),
      }],
    }
    return
  }

  const result = validate(data)
  validation.value = result

  if (result.valid) {
    const parsed = parseSchema(data)
    schema.value = parsed
    sourceJsonFileName.value = file.name
    currentTick.value = 0
    activeCameraId.value = parsed.metadata.active_camera ?? '__camera__'
    selectedObjectIds.value = []
    cdnLoader.setVersion(parsed.metadata.mc_version)
  }
}

function dismissValidation() {
  validation.value = null
}

async function loadResourcePack(file: File) {
  await zipLoader.setResourcePack(file)
}

function setTick(tick: number) {
  currentTick.value = Math.max(0, Math.min(tick, totalTicks.value))
}

function setActiveCameraId(id: string) {
  activeCameraId.value = id
  if (schema.value) {
    schema.value.metadata.active_camera = id
  }
}

function updateMetadata(key: string, value: unknown) {
  if (!schema.value) return
  ;(schema.value.metadata as Record<string, unknown>)[key] = value
}

function selectObject(id: string, multi = false) {
  if (!multi) {
    selectedObjectIds.value = [id]
    return
  }

  if (selectedObjectIds.value.includes(id)) {
    selectedObjectIds.value = selectedObjectIds.value.filter(selectedId => selectedId !== id)
  } else {
    selectedObjectIds.value = [...selectedObjectIds.value, id]
  }
}

function clearObjectSelection() {
  selectedObjectIds.value = []
}

let playInterval: ReturnType<typeof setInterval> | null = null

function startPlay() {
  if (isPlaying.value) return
  isPlaying.value = true
  const msPerFrame = 1000 / fps.value
  playInterval = setInterval(() => {
    if (currentTick.value >= totalTicks.value) {
      currentTick.value = 0
    } else {
      setTick(currentTick.value + ticksPerFrame.value)
    }
  }, msPerFrame)
}

function stopPlay() {
  isPlaying.value = false
  if (playInterval) {
    clearInterval(playInterval)
    playInterval = null
  }
}

function togglePlay() {
  isPlaying.value ? stopPlay() : startPlay()
}

export function useAppState() {
  return {
    // state (schema は内部で直接変更するので readonly にしない)
    schema,
    validation: readonly(validation),
    currentTick: readonly(currentTick),
    isPlaying: readonly(isPlaying),
    activeCameraId: readonly(activeCameraId),
    sourceJsonFileName: readonly(sourceJsonFileName),
    selectedObjectIds: readonly(selectedObjectIds),
    isExporting: readonly(isExporting),
    exportProgress: readonly(exportProgress),

    // computed
    totalTicks,
    totalFrames,
    ticksPerFrame,
    cameraObjects,
    blockObjects,
    selectedObjects,
    fps,
    tps,

    // loaders
    zipLoader,
    cdnLoader,

    // mutable refs for exporter
    _isExporting: isExporting,
    _exportProgress: exportProgress,

    // actions
    loadJson,
    loadResourcePack,
    dismissValidation,
    setTick,
    setActiveCameraId,
    updateMetadata,
    selectObject,
    clearObjectSelection,
    togglePlay,
    startPlay,
    stopPlay,
  }
}
