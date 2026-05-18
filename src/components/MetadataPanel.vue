<script setup lang="ts">
import { computed } from 'vue'
import { useAppState } from '../composables/useAppState'
import type { GizmoSettings } from '../types/schema'
import { useI18n } from '../i18n'

const { schema, totalFrames, updateMetadata } = useAppState()
const { t } = useI18n()

const meta = computed(() => schema.value?.metadata)

// background_color を分解
const bgARGB = computed({
  get: () => meta.value?.background_color ?? '#00000000',
  set: (v) => updateMetadata('background_color', v),
})

const bgHex = computed(() => '#' + bgARGB.value.slice(3)) // #RRGGBB
const bgAlpha = computed(() => parseInt(bgARGB.value.slice(1, 3), 16))

function onColorChange(e: Event) {
  const hex = (e.target as HTMLInputElement).value // #RRGGBB
  const aa = String(bgAlpha.value.toString(16).padStart(2, '0')).toUpperCase()
  bgARGB.value = `#${aa}${hex.slice(1).toUpperCase()}`
}

function onAlphaChange(e: Event) {
  const alpha = parseInt((e.target as HTMLInputElement).value)
  const aa = alpha.toString(16).padStart(2, '0').toUpperCase()
  const rrggbb = bgARGB.value.slice(3)
  bgARGB.value = `#${aa}${rrggbb}`
}

function defaultGizmo(): GizmoSettings {
  return {
    visible: false,
    origin: [64, 64],
  }
}

function updateGizmo(value: Partial<GizmoSettings>) {
  const current = meta.value?.gizmo ?? defaultGizmo()
  updateMetadata('gizmo', {
    ...current,
    ...value,
    origin: value.origin ?? [...current.origin],
  })
}

function onGizmoVisibleChange(e: Event) {
  updateGizmo({ visible: (e.target as HTMLInputElement).checked })
}

function onGizmoOriginChange(index: 0 | 1, e: Event) {
  const current = meta.value?.gizmo ?? defaultGizmo()
  const origin: [number, number] = [...current.origin]
  origin[index] = +(e.target as HTMLInputElement).value
  updateGizmo({ origin })
}
</script>

<template>
  <aside class="panel">
    <div class="panel__title">{{ t('metadata.title') }}</div>

    <template v-if="meta">
      <div class="field-group">
        <div class="field">
          <label>{{ t('metadata.mcVersion') }}</label>
          <input type="text" :value="meta.mc_version"
            @change="updateMetadata('mc_version', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="field row">
          <div>
            <label>{{ t('metadata.resolutionW') }}</label>
            <input type="number" :value="meta.resolution[0]" min="1"
              @change="updateMetadata('resolution', [+($event.target as HTMLInputElement).value, meta!.resolution[1]])" />
          </div>
          <div>
            <label>{{ t('metadata.resolutionH') }}</label>
            <input type="number" :value="meta.resolution[1]" min="1"
              @change="updateMetadata('resolution', [meta!.resolution[0], +($event.target as HTMLInputElement).value])" />
          </div>
        </div>
        <div class="field row">
          <div>
            <label>FPS</label>
            <input type="number" :value="meta.fps" min="1" max="120"
              @change="updateMetadata('fps', +($event.target as HTMLInputElement).value)" />
          </div>
          <div>
            <label>TPS</label>
            <input type="number" :value="meta.ticks_per_second" min="1" max="20"
              @change="updateMetadata('ticks_per_second', +($event.target as HTMLInputElement).value)" />
          </div>
        </div>
        <div class="field">
          <label>{{ t('metadata.totalTicks') }}</label>
          <input type="number" :value="meta.duration_ticks" min="1"
            @change="updateMetadata('duration_ticks', +($event.target as HTMLInputElement).value)" />
        </div>
        <div class="field frames-info">
          {{ t('metadata.totalFrames') }}: <strong>{{ totalFrames }}</strong> / 4096
          <span v-if="totalFrames > 4096" class="error-tag">{{ t('metadata.frameLimitExceeded') }}</span>
        </div>

        <!-- 背景色 -->
        <div class="field">
          <label>{{ t('metadata.backgroundColor') }}</label>
          <div class="color-row">
            <input type="color" :value="bgHex" @input="onColorChange" class="color-picker" />
            <div class="alpha-col">
              <label class="sub-label">Alpha {{ bgAlpha }}</label>
              <input type="range" min="0" max="255" :value="bgAlpha" @input="onAlphaChange" />
            </div>
            <code class="argb-code">{{ bgARGB }}</code>
          </div>
        </div>

        <div class="field gizmo-field">
          <label class="checkbox-row">
            <input
              type="checkbox"
              :checked="meta.gizmo?.visible ?? false"
              @change="onGizmoVisibleChange"
            />
            {{ t('metadata.showGizmo') }}
          </label>
          <div class="field row">
            <div>
              <label>{{ t('metadata.originX') }}</label>
              <input
                type="number"
                :value="meta.gizmo?.origin[0] ?? 64"
                step="1"
                @change="onGizmoOriginChange(0, $event)"
              />
            </div>
            <div>
              <label>{{ t('metadata.originY') }}</label>
              <input
                type="number"
                :value="meta.gizmo?.origin[1] ?? 64"
                step="1"
                @change="onGizmoOriginChange(1, $event)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="empty-state">{{ t('metadata.loadJsonPrompt') }}</div>
  </aside>
</template>

<style scoped>
.panel {
  padding: 0.75rem;
  overflow-y: auto;
}

.panel__title {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 0.75rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field label {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.field.row {
  flex-direction: row;
  gap: 0.5rem;
}

.field.row > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

input[type='text'],
input[type='number'] {
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  padding: 0.25rem 0.4rem;
  width: 100%;
  box-sizing: border-box;
}

input[type='text']:focus,
input[type='number']:focus {
  outline: none;
  border-color: var(--accent);
}

.frames-info {
  font-size: 0.75rem;
  color: var(--text-muted);
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
}

.frames-info strong {
  color: var(--text);
}

.error-tag {
  background: var(--error);
  color: #fff;
  border-radius: 3px;
  padding: 0 0.3rem;
  font-size: 0.65rem;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.color-picker {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: none;
  cursor: pointer;
  padding: 2px;
  flex-shrink: 0;
}

.alpha-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 80px;
}

.sub-label {
  font-size: 0.68rem;
  color: var(--text-muted);
}

input[type='range'] {
  width: 100%;
  accent-color: var(--accent);
}

input[type='checkbox'] {
  accent-color: var(--accent);
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--text);
  cursor: pointer;
}

.gizmo-field {
  border-top: 1px solid var(--border);
  margin-top: 0.25rem;
  padding-top: 0.6rem;
}

.argb-code {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
  background: var(--bg-3);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}

.empty-state {
  font-size: 0.78rem;
  color: var(--text-muted);
  text-align: center;
  margin-top: 2rem;
}
</style>
