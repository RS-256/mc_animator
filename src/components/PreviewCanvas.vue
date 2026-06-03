<script setup lang="ts">
import * as THREE from 'three'
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useAppState } from '../composables/useAppState'
import { SceneRenderer } from '../core/Renderer'
import { resolveScene } from '../core/Interpolator'
import { useI18n } from '../i18n'

const { schema, currentTick, resourcePackRevision, zipLoader, loadJson } = useAppState()
const { t } = useI18n()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
const displaySize = ref({ width: 0, height: 0 })
const isJsonDragOver = ref(false)
let sceneRenderer: SceneRenderer | null = null

const GIZMO_AXIS_LENGTH = 36

const stageStyle = computed(() => ({
  width: `${displaySize.value.width}px`,
  height: `${displaySize.value.height}px`,
}))

const gizmo = computed(() => schema.value?.metadata.gizmo)
const renderSize = computed(() => {
  const resolution = schema.value?.metadata.resolution
  return {
    width: resolution?.[0] ?? displaySize.value.width,
    height: resolution?.[1] ?? displaySize.value.height,
  }
})

const gizmoAxes = computed(() => {
  if (!schema.value || !gizmo.value?.visible) return []

  const { width, height } = renderSize.value
  if (width <= 0 || height <= 0) return []

  const resolved = resolveScene(schema.value, currentTick.value)
  const camera = new THREE.PerspectiveCamera(resolved.camera.fov, width / height, 0.1, 1000)
  camera.position.set(...resolved.camera.pos)
  camera.lookAt(new THREE.Vector3(...resolved.camera.look_at))
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()

  const toScreen = (v: THREE.Vector3) => {
    const projected = v.clone().project(camera)
    return {
      x: (projected.x + 1) * 0.5 * width,
      y: (1 - projected.y) * 0.5 * height,
    }
  }

  const center = new THREE.Vector3(...resolved.camera.look_at)
  const centerScreen = toScreen(center)
  const origin = { x: gizmo.value.origin[0], y: gizmo.value.origin[1] }

  return [
    { label: 'X', color: '#ff4d4d', world: new THREE.Vector3(1, 0, 0) },
    { label: 'Y', color: '#9cff3a', world: new THREE.Vector3(0, 1, 0) },
    { label: 'Z', color: '#4f8dff', world: new THREE.Vector3(0, 0, 1) },
  ].map(axis => {
    const target = toScreen(center.clone().add(axis.world))
    const dx = target.x - centerScreen.x
    const dy = target.y - centerScreen.y
    const distance = Math.hypot(dx, dy) || 1
    const x2 = origin.x + (dx / distance) * GIZMO_AXIS_LENGTH
    const y2 = origin.y + (dy / distance) * GIZMO_AXIS_LENGTH
    return { ...axis, x1: origin.x, y1: origin.y, x2, y2 }
  })
})

function fitCanvas() {
  if (!wrapperRef.value || !canvasRef.value || !sceneRenderer) return
  const wrapper = wrapperRef.value
  const w = wrapper.clientWidth
  const h = wrapper.clientHeight

  const meta = schema.value?.metadata
  if (meta) {
    const [rw, rh] = meta.resolution
    const scale = Math.min(w / rw, h / rh)
    const dw = Math.floor(rw * scale)
    const dh = Math.floor(rh * scale)
    displaySize.value = { width: dw, height: dh }
    sceneRenderer.setSize(rw, rh)
  } else {
    displaySize.value = { width: w, height: h }
    sceneRenderer.setSize(w, h)
  }
}

function isJsonDrop(event: DragEvent) {
  const items = Array.from(event.dataTransfer?.items ?? [])
  if (items.some(item => item.kind === 'file' && item.type === 'application/json')) return true

  const files = Array.from(event.dataTransfer?.files ?? [])
  return files.some(file => file.name.toLowerCase().endsWith('.json'))
}

function handleJsonDragOver(event: DragEvent) {
  if (schema.value || !isJsonDrop(event)) return
  event.preventDefault()
  isJsonDragOver.value = true
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function handleJsonDragLeave(event: DragEvent) {
  const target = event.currentTarget as HTMLElement
  const nextTarget = event.relatedTarget as Node | null
  if (!nextTarget || !target.contains(nextTarget)) {
    isJsonDragOver.value = false
  }
}

function handleJsonDrop(event: DragEvent) {
  if (schema.value) return

  event.preventDefault()
  isJsonDragOver.value = false

  const file = Array.from(event.dataTransfer?.files ?? [])
    .find(candidate => candidate.name.toLowerCase().endsWith('.json'))

  if (file) loadJson(file)
}

onMounted(() => {
  if (!canvasRef.value) return
  sceneRenderer = new SceneRenderer(canvasRef.value)
  fitCanvas()

  const ro = new ResizeObserver(fitCanvas)
  if (wrapperRef.value) ro.observe(wrapperRef.value)

  // ループ起動
  sceneRenderer.startPreview(() => currentTick.value)
})

// schema が変わったらシーンをリロード
watch(schema, async (s) => {
  if (!sceneRenderer || !s) return
  await sceneRenderer.loadSchema(s, zipLoader, currentTick.value)
  fitCanvas()
})

watch(resourcePackRevision, async () => {
  if (!sceneRenderer || !schema.value) return
  await sceneRenderer.loadSchema(schema.value, zipLoader, currentTick.value)
  fitCanvas()
})

// tick が変わったときは自動的に startPreview のループが拾う

onUnmounted(() => {
  sceneRenderer?.dispose()
})
</script>

<template>
  <div
    ref="wrapperRef"
    class="preview-wrapper"
    :class="{ 'preview-wrapper--drop-active': isJsonDragOver }"
    @dragover="handleJsonDragOver"
    @dragleave="handleJsonDragLeave"
    @drop="handleJsonDrop"
  >
    <div class="preview-stage" :style="stageStyle">
      <canvas ref="canvasRef" class="preview-canvas" />
      <svg
        v-if="schema && gizmo?.visible"
        class="gizmo-overlay"
        :viewBox="`0 0 ${renderSize.width} ${renderSize.height}`"
        aria-hidden="true"
      >
        <g class="gizmo">
          <line
            v-for="axis in gizmoAxes"
            :key="axis.label"
            :x1="axis.x1"
            :y1="axis.y1"
            :x2="axis.x2"
            :y2="axis.y2"
            :stroke="axis.color"
          />
        </g>
      </svg>
    </div>
    <div v-if="!schema" class="preview-placeholder">
      <div
        class="placeholder-content"
        :class="{ 'placeholder-content--drop-active': isJsonDragOver }"
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>
        <p class="placeholder-content__title">{{ t('preview.dropJsonTitle') }}</p>
        <p class="placeholder-content__hint">{{ t('preview.dropJsonHint') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-wrapper {
  position: relative;
  flex: 1;
  background: repeating-conic-gradient(var(--bg-3) 0% 25%, var(--bg-2) 0% 50%) 0 0 / 20px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 0;
}

.preview-wrapper--drop-active {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.preview-stage {
  position: relative;
  flex-shrink: 0;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5);
}

.preview-canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.gizmo-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

.gizmo {
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.85));
}

.gizmo line {
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
}

.preview-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-muted);
  padding: 1rem;
  text-align: center;
  transition: color 0.15s, transform 0.15s;
}

.placeholder-content--drop-active {
  color: var(--accent);
  transform: translateY(-2px);
}

.placeholder-content p {
  margin: 0;
}

.placeholder-content__title {
  color: var(--text);
  font-size: 0.9rem;
  font-weight: 600;
}

.placeholder-content__hint {
  max-width: 28rem;
  font-size: 0.75rem;
}
</style>
