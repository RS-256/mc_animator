import { ref, computed, readonly } from 'vue'
import type { AnimationSchema, BlockKeyframe, CameraKeyframe, SceneObject, ValidationResult } from '../types/schema'
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
const savedSchemaText = ref<string | null>(null)

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

const isSchemaDirty = computed(() =>
  Boolean(schema.value && savedSchemaText.value !== serializeSchema(schema.value)),
)

// ── アクション ────────────────────────────────────────────────────

function serializeSchema(value: AnimationSchema) {
  return JSON.stringify(value)
}

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
    savedSchemaText.value = serializeSchema(parsed)
    cdnLoader.setVersion(parsed.metadata.mc_version)
  }
}

function createNewJson() {
  const nextSchema: AnimationSchema = {
    metadata: {
      format_version: 1,
      mc_version: '26.1.2',
      resolution: [1920, 1080],
      fps: 60,
      ticks_per_second: 20,
      duration_ticks: 100,
      active_camera: '__camera__',
    },
    objects: [{
      id: '__camera__',
      type: 'camera',
      keyframes: [],
    }],
  }

  schema.value = nextSchema
  validation.value = null
  currentTick.value = 0
  activeCameraId.value = '__camera__'
  selectedObjectIds.value = []
  sourceJsonFileName.value = 'animation.json'
  savedSchemaText.value = serializeSchema(nextSchema)
  cdnLoader.setVersion(nextSchema.metadata.mc_version)
}

function markSchemaSaved() {
  savedSchemaText.value = schema.value ? serializeSchema(schema.value) : null
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

function addObject(id: string, type: SceneObject['type']) {
  if (!schema.value) return false

  const trimmedId = id.trim()
  if (!trimmedId || schema.value.objects.some(object => object.id === trimmedId)) {
    return false
  }

  const hadCamera = schema.value.objects.some(object => object.type === 'camera')
  const object: SceneObject = {
    id: trimmedId,
    type,
    keyframes: [],
  }

  schema.value = {
    ...schema.value,
    objects: [...schema.value.objects, object],
  }

  selectedObjectIds.value = [trimmedId]

  if (type === 'camera' && !hadCamera) {
    activeCameraId.value = trimmedId
    schema.value.metadata.active_camera = trimmedId
  }

  return true
}

function deleteSelectedObjects() {
  if (!schema.value || selectedObjectIds.value.length === 0) return 0

  const idsToDelete = new Set(selectedObjectIds.value)
  const remainingObjects = schema.value.objects.filter(object => !idsToDelete.has(object.id))

  schema.value = {
    ...schema.value,
    objects: remainingObjects,
  }

  selectedObjectIds.value = []

  if (idsToDelete.has(activeCameraId.value)) {
    const nextCamera = remainingObjects.find(object => object.type === 'camera')
    activeCameraId.value = nextCamera?.id ?? '__camera__'
    schema.value.metadata.active_camera = nextCamera?.id
  }

  return idsToDelete.size
}

function addKeyframe(objectId: string) {
  if (!schema.value) return null

  let addedIndex: number | null = null
  const objects = schema.value.objects.map(object => {
    if (object.id !== objectId) return object

    const lastTick = object.keyframes.at(-1)?.tick ?? -1
    const tick = lastTick + 1

    if (object.type === 'block') {
      const keyframe: BlockKeyframe = { tick }
      addedIndex = object.keyframes.length
      return { ...object, keyframes: [...object.keyframes, keyframe] }
    }

    const keyframe: CameraKeyframe = { tick }
    addedIndex = object.keyframes.length
    return { ...object, keyframes: [...object.keyframes, keyframe] }
  })

  schema.value = { ...schema.value, objects }
  return addedIndex
}

function deleteKeyframes(selections: { objectId: string; index: number }[]) {
  if (!schema.value || selections.length === 0) return 0

  const indicesByObject = new Map<string, Set<number>>()
  selections.forEach(selection => {
    const indices = indicesByObject.get(selection.objectId) ?? new Set<number>()
    indices.add(selection.index)
    indicesByObject.set(selection.objectId, indices)
  })

  let deletedCount = 0
  const objects = schema.value.objects.map(object => {
    const indices = indicesByObject.get(object.id)
    if (!indices) return object

    if (object.type === 'block') {
      const keyframes = object.keyframes.filter((_, index) => !indices.has(index))
      deletedCount += object.keyframes.length - keyframes.length
      return { ...object, keyframes }
    }

    const keyframes = object.keyframes.filter((_, index) => !indices.has(index))
    deletedCount += object.keyframes.length - keyframes.length
    return { ...object, keyframes }
  })

  schema.value = { ...schema.value, objects }
  return deletedCount
}

function updateKeyframe(
  objectId: string,
  index: number,
  patch: Partial<BlockKeyframe | CameraKeyframe>,
) {
  if (!schema.value) return

  const objects = schema.value.objects.map(object => {
    if (object.id !== objectId || !object.keyframes[index]) return object

    const keyframe = {
      ...object.keyframes[index],
      ...patch,
    } as Record<string, unknown>

    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined) delete keyframe[key]
    })

    const keyframes = object.keyframes.map((existingKeyframe, existingIndex) =>
      existingIndex === index ? keyframe : existingKeyframe,
    )

    return { ...object, keyframes } as SceneObject
  })

  schema.value = { ...schema.value, objects }
}

function reorderKeyframe(objectId: string, fromIndex: number, toIndex: number) {
  if (!schema.value || fromIndex === toIndex) return false

  let moved = false
  const objects = schema.value.objects.map(object => {
    if (object.id !== objectId) return object
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= object.keyframes.length ||
      toIndex >= object.keyframes.length
    ) {
      return object
    }

    const keyframes = [...object.keyframes]
    const [keyframe] = keyframes.splice(fromIndex, 1)
    keyframes.splice(toIndex, 0, keyframe)
    moved = true
    return { ...object, keyframes } as SceneObject
  })

  if (!moved) return false
  schema.value = { ...schema.value, objects }
  return true
}

let playInterval: ReturnType<typeof setInterval> | null = null

function startPlay() {
  if (isPlaying.value) return
  if (currentTick.value >= totalTicks.value) {
    setTick(0)
  }

  isPlaying.value = true
  const msPerFrame = 1000 / fps.value
  playInterval = setInterval(() => {
    if (currentTick.value >= totalTicks.value) {
      setTick(0)
    } else {
      const nextTick = currentTick.value + ticksPerFrame.value
      setTick(nextTick > totalTicks.value ? totalTicks.value : nextTick)
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
    isSchemaDirty,
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
    createNewJson,
    markSchemaSaved,
    loadResourcePack,
    dismissValidation,
    setTick,
    setActiveCameraId,
    updateMetadata,
    selectObject,
    clearObjectSelection,
    addObject,
    deleteSelectedObjects,
    addKeyframe,
    deleteKeyframes,
    updateKeyframe,
    reorderKeyframe,
    togglePlay,
    startPlay,
    stopPlay,
  }
}
