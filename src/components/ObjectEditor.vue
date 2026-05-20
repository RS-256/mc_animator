<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAppState } from '../composables/useAppState'
import { useI18n } from '../i18n'
import { SUPPORTED_EASINGS } from '../types/schema'
import type { BlockKeyframe, BlockState, CameraKeyframe, CameraPosition, EasingType, SceneObject, Vec3 } from '../types/schema'

type Keyframe = BlockKeyframe | CameraKeyframe
interface KeyframeSelection {
  objectId: string
  index: number
}

const { selectedObjects, addKeyframe, deleteKeyframes, updateKeyframe, reorderKeyframe } = useAppState()
const { t } = useI18n()
const selectedKeyframes = ref<string[]>([])
const stateErrors = ref<Record<string, string>>({})
const draggedKeyframe = ref<KeyframeSelection | null>(null)
const dragOverKey = ref<string | null>(null)

const hasSelection = computed(() => selectedObjects.value.length > 0)
const canAddKeyframe = computed(() => selectedObjects.value.length === 1)
const canDeleteKeyframes = computed(() => selectedKeyframes.value.length > 0)

watch(
  () => selectedObjects.value.map(object => `${object.id}:${object.keyframes.length}`).join('|'),
  () => {
    const validKeys = new Set(
      selectedObjects.value.flatMap(object =>
        object.keyframes.map((_, index) => keyframeKey(object.id, index)),
      ),
    )
    selectedKeyframes.value = selectedKeyframes.value.filter(key => validKeys.has(key))
  },
)

function keyframeTitle(keyframe: Keyframe, index: number) {
  const tickLabel = keyframe.tick_mode === 'relative'
    ? `+${keyframe.tick}`
    : String(keyframe.tick)
  return `#${index + 1} / tick ${tickLabel}`
}

function objectTypeLabel(object: SceneObject) {
  return t(object.type === 'block' ? 'objects.typeBlock' : 'objects.typeCamera')
}

function keyframeKey(objectId: string, index: number) {
  return JSON.stringify([objectId, index])
}

function isKeyframeSelected(objectId: string, index: number) {
  return selectedKeyframes.value.includes(keyframeKey(objectId, index))
}

function selectKeyframe(event: MouseEvent, objectId: string, index: number) {
  const key = keyframeKey(objectId, index)

  if (event.ctrlKey || event.metaKey) {
    selectedKeyframes.value = selectedKeyframes.value.includes(key)
      ? selectedKeyframes.value.filter(selectedKey => selectedKey !== key)
      : [...selectedKeyframes.value, key]
    return
  }

  selectedKeyframes.value = [key]
}

function parseSelectedKeyframes(): KeyframeSelection[] {
  return selectedKeyframes.value.map(key => {
    const [objectId, index] = JSON.parse(key) as [string, number]
    return { objectId, index }
  })
}

function handleAddKeyframe() {
  const object = selectedObjects.value[0]
  if (!object || selectedObjects.value.length !== 1) return

  const addedIndex = addKeyframe(object.id)
  if (addedIndex !== null) {
    selectedKeyframes.value = [keyframeKey(object.id, addedIndex)]
  }
}

function handleDeleteKeyframes() {
  const deletedCount = deleteKeyframes(parseSelectedKeyframes())
  if (deletedCount > 0) selectedKeyframes.value = []
}

function startKeyframeDrag(event: DragEvent, objectId: string, index: number) {
  draggedKeyframe.value = { objectId, index }
  selectedKeyframes.value = [keyframeKey(objectId, index)]
  event.dataTransfer?.setData('text/plain', keyframeKey(objectId, index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function handleKeyframeDragOver(event: DragEvent, objectId: string, index: number) {
  if (!draggedKeyframe.value || draggedKeyframe.value.objectId !== objectId) return
  event.preventDefault()
  dragOverKey.value = keyframeKey(objectId, index)
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function handleKeyframeDrop(event: DragEvent, objectId: string, index: number) {
  event.preventDefault()
  const source = draggedKeyframe.value
  if (!source || source.objectId !== objectId) return

  if (reorderKeyframe(objectId, source.index, index)) {
    selectedKeyframes.value = [keyframeKey(objectId, index)]
  }

  draggedKeyframe.value = null
  dragOverKey.value = null
}

function finishKeyframeDrag() {
  draggedKeyframe.value = null
  dragOverKey.value = null
}

function eventValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value
}

function parseNumber(value: string) {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const number = Number(trimmed)
  return Number.isFinite(number) ? number : undefined
}

function updateTick(objectId: string, index: number, value: string) {
  const tick = parseNumber(value)
  if (tick !== undefined) updateKeyframe(objectId, index, { tick })
}

function updateTickMode(objectId: string, index: number, checked: boolean) {
  updateKeyframe(objectId, index, { tick_mode: checked ? 'relative' : undefined })
}

function updateEasing(objectId: string, index: number, value: string) {
  updateKeyframe(objectId, index, { easing: value === '' ? undefined : value as EasingType })
}

function updateBlock(objectId: string, index: number, value: string) {
  const trimmed = value.trim()
  updateKeyframe(objectId, index, { block: trimmed === '' ? undefined : trimmed === 'null' ? null : trimmed })
}

function updateMultiplier(objectId: string, index: number, value: string) {
  updateKeyframe(objectId, index, { multiplier: parseNumber(value) })
}

function updateFov(objectId: string, index: number, value: string) {
  updateKeyframe(objectId, index, { fov: parseNumber(value) })
}

function vectorComponent(value: Vec3 | CameraPosition | undefined, index: number) {
  return value?.[index] ?? ''
}

function updateNumberVector(
  objectId: string,
  index: number,
  field: 'pos' | 'look_at',
  source: Vec3 | undefined,
  componentIndex: number,
  value: string,
) {
  const next = [...(source ?? ['', '', ''])] as Array<number | string>
  next[componentIndex] = value.trim()

  if (next.every(component => String(component).trim() === '')) {
    updateKeyframe(objectId, index, { [field]: undefined })
    return
  }

  const parsed = next.map(component => parseNumber(String(component)))
  if (parsed.every(component => component !== undefined)) {
    updateKeyframe(objectId, index, { [field]: parsed as Vec3 })
  }
}

function updateCameraPosition(
  objectId: string,
  index: number,
  source: CameraPosition | undefined,
  componentIndex: number,
  value: string,
) {
  const next = [...(source ?? ['', '', ''])] as Array<number | string>
  next[componentIndex] = value.trim()

  if (next.every(component => String(component).trim() === '')) {
    updateKeyframe(objectId, index, { pos: undefined })
    return
  }

  const parsed = next.map(component => {
    const text = String(component).trim()
    if (text.startsWith('~')) return text
    return parseNumber(text)
  })

  if (parsed.every(component => component !== undefined)) {
    updateKeyframe(objectId, index, { pos: parsed as CameraPosition })
  }
}

function stateText(keyframe: BlockKeyframe) {
  return keyframe.state ? JSON.stringify(keyframe.state, null, 2) : ''
}

function updateState(objectId: string, index: number, value: string) {
  const errorKey = keyframeKey(objectId, index)
  const trimmed = value.trim()

  if (trimmed === '') {
    const { [errorKey]: _removed, ...rest } = stateErrors.value
    stateErrors.value = rest
    updateKeyframe(objectId, index, { state: undefined })
    return
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      stateErrors.value = { ...stateErrors.value, [errorKey]: t('editor.stateJsonObjectError') }
      return
    }
    const { [errorKey]: _removed, ...rest } = stateErrors.value
    stateErrors.value = rest
    updateKeyframe(objectId, index, { state: parsed as BlockState })
  } catch {
    stateErrors.value = { ...stateErrors.value, [errorKey]: t('editor.stateJsonParseError') }
  }
}
</script>

<template>
  <aside class="editor-panel">
    <div class="editor-panel__header">
      <div class="editor-panel__title">{{ t('editor.title') }}</div>
      <div class="editor-panel__actions" aria-label="Keyframe actions">
        <button
          type="button"
          class="icon-button"
          :aria-label="t('editor.addKeyframe')"
          :title="t('editor.addKeyframe')"
          :disabled="!canAddKeyframe"
          @click="handleAddKeyframe"
        >
          +
        </button>
        <button
          type="button"
          class="icon-button"
          :aria-label="t('editor.deleteKeyframes')"
          :title="t('editor.deleteKeyframes')"
          :disabled="!canDeleteKeyframes"
          @click="handleDeleteKeyframes"
        >
          -
        </button>
      </div>
    </div>

    <div v-if="hasSelection" class="editor-content">
      <section
        v-for="object in selectedObjects"
        :key="object.id"
        class="object-section"
      >
        <div class="object-section__header">
          <span class="object-section__id">{{ object.id }}</span>
          <span class="object-section__meta">{{ objectTypeLabel(object) }} / {{ object.keyframes.length }} kf</span>
        </div>

        <div v-if="object.keyframes.length > 0" class="keyframe-list">
          <details
            v-for="(keyframe, index) in object.keyframes"
            :key="`${object.id}-${index}-${keyframe.tick}`"
            class="keyframe-item"
            :class="{
              'keyframe-item--selected': isKeyframeSelected(object.id, index),
              'keyframe-item--drag-over': dragOverKey === keyframeKey(object.id, index),
              'keyframe-item--dragging': draggedKeyframe?.objectId === object.id && draggedKeyframe.index === index,
            }"
            @dragover="handleKeyframeDragOver($event, object.id, index)"
            @dragleave="dragOverKey = null"
            @drop="handleKeyframeDrop($event, object.id, index)"
          >
            <summary
              class="keyframe-summary"
              @click="selectKeyframe($event, object.id, index)"
            >
              <span
                class="keyframe-summary__drag"
                draggable="true"
                :title="t('editor.dragKeyframe')"
                :aria-label="t('editor.dragKeyframe')"
                @click.stop
                @dragstart="startKeyframeDrag($event, object.id, index)"
                @dragend="finishKeyframeDrag"
              >
                ::
              </span>
              <span class="keyframe-summary__caret" aria-hidden="true" />
              <span class="keyframe-summary__label">{{ keyframeTitle(keyframe, index) }}</span>
            </summary>
            <div class="keyframe-form">
              <div class="form-row form-row--tick">
                <label class="field field--tick">
                  <span class="field__label">tick</span>
                  <input
                    class="field__input"
                    type="number"
                    step="1"
                    :value="keyframe.tick"
                    @change="updateTick(object.id, index, eventValue($event))"
                  >
                </label>
                <label class="check-field">
                  <input
                    type="checkbox"
                    :checked="keyframe.tick_mode === 'relative'"
                    @change="updateTickMode(object.id, index, ($event.target as HTMLInputElement).checked)"
                  >
                  <span>relative</span>
                </label>
              </div>

              <label v-if="object.type === 'block'" class="field">
                <span class="field__label">block</span>
                <input
                  class="field__input"
                  type="text"
                  :value="(keyframe as BlockKeyframe).block ?? ''"
                  placeholder="minecraft:stone"
                  @change="updateBlock(object.id, index, eventValue($event))"
                >
              </label>

              <div v-if="object.type === 'block'" class="field">
                <span class="field__label">state JSON</span>
                <textarea
                  class="field__textarea"
                  :value="stateText(keyframe as BlockKeyframe)"
                  spellcheck="false"
                  placeholder='{"facing":"north"}'
                  @change="updateState(object.id, index, eventValue($event))"
                />
                <div v-if="stateErrors[keyframeKey(object.id, index)]" class="field-error">
                  {{ stateErrors[keyframeKey(object.id, index)] }}
                </div>
              </div>

              <div v-if="object.type === 'block'" class="field">
                <span class="field__label">pos</span>
                <div class="vec-inputs">
                  <input
                    v-for="axisIndex in 3"
                    :key="axisIndex"
                    class="field__input"
                    type="number"
                    step="any"
                    :value="vectorComponent((keyframe as BlockKeyframe).pos, axisIndex - 1)"
                    @change="updateNumberVector(object.id, index, 'pos', (keyframe as BlockKeyframe).pos, axisIndex - 1, eventValue($event))"
                  >
                </div>
              </div>

              <label v-if="object.type === 'block'" class="field">
                <span class="field__label">multiplier</span>
                <input
                  class="field__input"
                  type="number"
                  step="any"
                  :value="(keyframe as BlockKeyframe).multiplier ?? ''"
                  @change="updateMultiplier(object.id, index, eventValue($event))"
                >
              </label>

              <div v-if="object.type === 'camera'" class="field">
                <span class="field__label">pos</span>
                <div class="vec-inputs">
                  <input
                    v-for="axisIndex in 3"
                    :key="axisIndex"
                    class="field__input"
                    type="text"
                    :value="vectorComponent((keyframe as CameraKeyframe).pos, axisIndex - 1)"
                    @change="updateCameraPosition(object.id, index, (keyframe as CameraKeyframe).pos, axisIndex - 1, eventValue($event))"
                  >
                </div>
              </div>

              <div v-if="object.type === 'camera'" class="field">
                <span class="field__label">look_at</span>
                <div class="vec-inputs">
                  <input
                    v-for="axisIndex in 3"
                    :key="axisIndex"
                    class="field__input"
                    type="number"
                    step="any"
                    :value="vectorComponent((keyframe as CameraKeyframe).look_at, axisIndex - 1)"
                    @change="updateNumberVector(object.id, index, 'look_at', (keyframe as CameraKeyframe).look_at, axisIndex - 1, eventValue($event))"
                  >
                </div>
              </div>

              <label v-if="object.type === 'camera'" class="field">
                <span class="field__label">fov</span>
                <input
                  class="field__input"
                  type="number"
                  step="any"
                  :value="(keyframe as CameraKeyframe).fov ?? ''"
                  @change="updateFov(object.id, index, eventValue($event))"
                >
              </label>

              <label class="field">
                <span class="field__label">easing</span>
                <select
                  class="field__input"
                  :value="keyframe.easing ?? ''"
                  @change="updateEasing(object.id, index, eventValue($event))"
                >
                  <option value="">default</option>
                  <option
                    v-for="easing in SUPPORTED_EASINGS"
                    :key="easing"
                    :value="easing"
                  >
                    {{ easing }}
                  </option>
                </select>
              </label>
            </div>
          </details>
        </div>

        <div v-else class="empty-state">{{ t('editor.emptyKeyframes') }}</div>
      </section>
    </div>

    <div v-else class="empty-state">{{ t('editor.emptySelection') }}</div>
  </aside>
</template>

<style scoped>
.editor-panel {
  width: 280px;
  min-width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 0.75rem;
  background: var(--bg-2);
  border-left: 1px solid var(--border);
}

.editor-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-bottom: 0.75rem;
}

.editor-panel__title {
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.editor-panel__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.icon-button {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-3);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.9rem;
  line-height: 1;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}

.icon-button:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--text);
}

.icon-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.editor-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.object-section {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.object-section__header {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.object-section__id {
  overflow: hidden;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.object-section__meta {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.keyframe-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.keyframe-item {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-3);
}

.keyframe-item[open] {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}

.keyframe-item--selected {
  border-color: var(--accent);
  background: rgba(87, 171, 90, 0.18);
}

.keyframe-item--drag-over {
  border-color: var(--warning);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 50%, transparent);
}

.keyframe-item--dragging {
  opacity: 0.55;
}

.keyframe-summary {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 34px;
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.keyframe-summary__drag {
  display: grid;
  place-items: center;
  width: 16px;
  height: 22px;
  flex: 0 0 16px;
  color: var(--text-muted);
  cursor: grab;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: -0.12em;
}

.keyframe-summary__drag:active {
  cursor: grabbing;
}

.keyframe-summary::-webkit-details-marker {
  display: none;
}

.keyframe-summary__caret {
  width: 0;
  height: 0;
  flex: 0 0 auto;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 6px solid var(--text-muted);
  transition: transform 0.12s;
}

.keyframe-item[open] .keyframe-summary__caret {
  transform: rotate(90deg);
}

.keyframe-summary__label {
  overflow: hidden;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keyframe-form {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.5rem;
  border-top: 1px solid var(--border);
}

.form-row {
  display: flex;
  gap: 0.5rem;
  align-items: end;
}

.form-row--tick {
  align-items: center;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.field--tick {
  flex: 1;
}

.field__label {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.66rem;
  line-height: 1;
}

.field__input,
.field__textarea {
  width: 100%;
  min-height: 28px;
  padding: 0.25rem 0.35rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  outline: none;
  background: color-mix(in srgb, var(--bg-1) 36%, var(--bg-3));
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.72rem;
}

.field__input:focus,
.field__textarea:focus {
  border-color: var(--accent);
}

.field__textarea {
  min-height: 58px;
  resize: vertical;
}

.vec-inputs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.3rem;
}

.check-field {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 28px;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  user-select: none;
}

.check-field input {
  accent-color: var(--accent);
}

.field-error {
  color: var(--error);
  font-size: 0.68rem;
}

.empty-state {
  color: var(--text-muted);
  font-size: 0.78rem;
}
</style>
