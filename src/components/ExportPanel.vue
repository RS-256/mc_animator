<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppState } from '../composables/useAppState'
import { exportAnimation, type ExportFormat, type ExportMode } from '../core/Exporter'
import { SceneRenderer } from '../core/Renderer'

const {
  schema,
  zipLoader,
  totalFrames,
  _isExporting: isExporting,
  _exportProgress: exportProgress,
} = useAppState()

const format = ref<ExportFormat>('png_zip')
const exportMode = ref<ExportMode>('direct')
const isExportMenuOpen = ref(false)
let cancelFlag = false

const isVideoFormat = computed(() => format.value !== 'png_zip')
const selectedModeLabel = computed(() => {
  if (!isVideoFormat.value) return 'PNG ZIP'
  return exportMode.value === 'direct' ? '直接動画' : 'ローカル変換'
})

async function startExport(mode: ExportMode = exportMode.value) {
  if (!schema.value) return
  isExportMenuOpen.value = false

  // オフスクリーン用レンダラーを別途生成
  const offscreen = document.createElement('canvas')
  const [w, h] = schema.value.metadata.resolution
  offscreen.width = w
  offscreen.height = h

  const renderer = new SceneRenderer(offscreen, { pixelRatio: 1 })
  renderer.setSize(w, h)
  await renderer.loadSchema(schema.value, zipLoader)

  isExporting.value = true
  cancelFlag = false
  exportProgress.value = { current: 0, total: totalFrames.value }

  try {
    await exportAnimation(schema.value, renderer, {
      format: format.value,
      mode: isVideoFormat.value ? mode : 'direct',
      onProgress: (current, total) => {
        exportProgress.value = { current, total }
      },
      onCancel: () => cancelFlag,
    })
  } catch (error) {
    console.error(error)
    alert(error instanceof Error ? error.message : 'エクスポートに失敗しました。')
  } finally {
    renderer.dispose()
    isExporting.value = false
  }
}

function cancelExport() {
  cancelFlag = true
}

function setExportMode(mode: ExportMode) {
  exportMode.value = mode
  isExportMenuOpen.value = false
}

function toggleExportMenu() {
  if (!isVideoFormat.value) return
  isExportMenuOpen.value = !isExportMenuOpen.value
}

const progressPct = () =>
  exportProgress.value.total > 0
    ? Math.round((exportProgress.value.current / exportProgress.value.total) * 100)
    : 0
</script>

<template>
  <div class="export-panel">
    <div class="export-panel__left">
      <label class="small-label">出力形式</label>
      <select v-model="format" class="format-select" :disabled="isExporting">
        <option value="png_zip">PNG シーケンス + ZIP</option>
        <option value="mkv_ffv1">ロスレス MKV / FFV1</option>
        <option value="mp4_h264">MP4 / H.264</option>
        <option value="mp4_h265">MP4 / H.265</option>
      </select>
    </div>

    <div v-if="!isExporting" class="export-panel__right">
      <button
        v-if="!isVideoFormat"
        class="btn btn--primary"
        :disabled="!schema || totalFrames > 4096"
        @click="startExport()"
      >
        レンダリング開始
      </button>
      <div v-else class="export-action">
        <button
          class="btn btn--primary export-action__main"
          :disabled="!schema || totalFrames > 4096"
          @click="startExport()"
        >
          レンダリング開始
          <span class="mode-label">{{ selectedModeLabel }}</span>
        </button>
        <button
          class="btn btn--primary export-action__arrow"
          :disabled="!schema || totalFrames > 4096"
          title="出力方法"
          @click="toggleExportMenu"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div v-if="isExportMenuOpen" class="export-menu">
          <button
            class="export-menu__item"
            :class="{ 'export-menu__item--active': exportMode === 'direct' }"
            @click="setExportMode('direct')"
          >
            動画として直接ダウンロード
          </button>
          <button
            class="export-menu__item"
            :class="{ 'export-menu__item--active': exportMode === 'local_package' }"
            @click="setExportMode('local_package')"
          >
            PNG連番 + ffmpegスクリプト
          </button>
        </div>
      </div>
    </div>

    <div v-else class="export-panel__right progress-area">
      <div class="progress-bar">
        <div class="progress-bar__fill" :style="{ width: progressPct() + '%' }" />
      </div>
      <span class="progress-label">
        {{ exportProgress.current }} / {{ exportProgress.total }} フレーム ({{ progressPct() }}%)
      </span>
      <button class="btn btn--ghost" @click="cancelExport">キャンセル</button>
    </div>
  </div>
</template>

<style scoped>
.export-panel {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1rem;
  height: 44px;
  background: var(--bg-2);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.small-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-right: 0.4rem;
}

.format-select {
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  font-size: 0.78rem;
  padding: 0.2rem 0.4rem;
  cursor: pointer;
}

.export-panel__left {
  display: flex;
  align-items: center;
}

.export-panel__right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
}

.export-action {
  position: relative;
  display: flex;
  align-items: center;
}

.export-action__main {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  padding-right: 0.65rem;
}

.export-action__arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  width: 32px;
  min-width: 32px;
  padding-inline: 0.45rem;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: 1px solid rgba(255,255,255,0.2);
}

.mode-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  height: 18px;
  margin-left: 0;
  padding: 0 0.35rem;
  border-radius: 3px;
  background: rgba(255,255,255,0.14);
  color: rgba(255,255,255,0.78);
  font-size: 0.68rem;
  line-height: 1;
  white-space: nowrap;
}

.export-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  width: 220px;
  padding: 4px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 8px 22px rgba(0,0,0,0.35);
  z-index: 10;
}

.export-menu__item {
  width: 100%;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 0.76rem;
  padding: 0.45rem 0.55rem;
  text-align: left;
}

.export-menu__item:hover,
.export-menu__item--active {
  background: rgba(255,255,255,0.08);
}

.progress-area {
  flex: 1;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-3);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar__fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.1s;
}

.progress-label {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
