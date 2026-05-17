<script setup lang="ts">
import { ref } from 'vue'
import { useAppState } from '../composables/useAppState'
import { exportAnimation, type ExportFormat } from '../core/Exporter'
import { SceneRenderer } from '../core/Renderer'

const {
  schema,
  zipLoader,
  totalFrames,
  _isExporting: isExporting,
  _exportProgress: exportProgress,
} = useAppState()

const format = ref<ExportFormat>('png_zip')
let cancelFlag = false

async function startExport() {
  if (!schema.value) return

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
        <option value="mkv_ffv1">ロスレス MKV / FFV1 変換パッケージ</option>
        <option value="mp4_h264">MP4 / H.264 変換パッケージ</option>
        <option value="mp4_h265">MP4 / H.265 変換パッケージ</option>
      </select>
    </div>

    <div v-if="!isExporting" class="export-panel__right">
      <button
        class="btn btn--primary"
        :disabled="!schema || totalFrames > 4096"
        @click="startExport"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        レンダリング開始
      </button>
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
