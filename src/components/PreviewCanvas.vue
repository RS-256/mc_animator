<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useAppState } from '../composables/useAppState'
import { SceneRenderer } from '../core/Renderer'

const { schema, currentTick, zipLoader } = useAppState()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
let sceneRenderer: SceneRenderer | null = null

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
    canvasRef.value.style.width = `${dw}px`
    canvasRef.value.style.height = `${dh}px`
    sceneRenderer.setSize(rw, rh)
  } else {
    canvasRef.value.style.width = `${w}px`
    canvasRef.value.style.height = `${h}px`
    sceneRenderer.setSize(w, h)
  }
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
  await sceneRenderer.loadSchema(s, zipLoader)
  fitCanvas()
})

// tick が変わったときは自動的に startPreview のループが拾う

onUnmounted(() => {
  sceneRenderer?.dispose()
})
</script>

<template>
  <div ref="wrapperRef" class="preview-wrapper">
    <canvas ref="canvasRef" class="preview-canvas" />
    <div v-if="!schema" class="preview-placeholder">
      <div class="placeholder-content">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>
        <p>JSON を読み込むとここにプレビューが表示されます</p>
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

.preview-canvas {
  display: block;
  image-rendering: pixelated;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5);
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
  gap: 0.75rem;
  color: var(--text-muted);
}

.placeholder-content p {
  font-size: 0.8rem;
  margin: 0;
}
</style>
