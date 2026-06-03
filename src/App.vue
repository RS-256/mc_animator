<script setup lang="ts">
import { ref } from 'vue'
import Toolbar from './components/Toolbar.vue'
import ValidationBanner from './components/ValidationBanner.vue'
import MetadataPanel from './components/MetadataPanel.vue'
import CameraPanel from './components/CameraPanel.vue'
import ObjectList from './components/ObjectList.vue'
import ObjectEditor from './components/ObjectEditor.vue'
import PreviewCanvas from './components/PreviewCanvas.vue'
import Timeline from './components/Timeline.vue'
import ExportPanel from './components/ExportPanel.vue'
import { useAppState } from './composables/useAppState'
import { useI18n } from './i18n'

const { loadResourcePack } = useAppState()
const { t } = useI18n()
const isResourcePackDragOver = ref(false)
const ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
])

function getDroppedZip(event: DragEvent) {
  return Array.from(event.dataTransfer?.files ?? [])
    .find(file => file.name.toLowerCase().endsWith('.zip'))
}

function isResourcePackDrop(event: DragEvent) {
  const items = Array.from(event.dataTransfer?.items ?? [])
  if (items.some(item => item.kind === 'file' && ZIP_MIME_TYPES.has(item.type))) return true

  const types = Array.from(event.dataTransfer?.types ?? [])
  if (types.includes('Files')) {
    return Array.from(event.dataTransfer?.files ?? [])
      .some(file => file.name.toLowerCase().endsWith('.zip'))
  }

  return false
}

function handleResourcePackDragOver(event: DragEvent) {
  if (!isResourcePackDrop(event)) return
  event.preventDefault()
  isResourcePackDragOver.value = true
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function handleResourcePackDragLeave(event: DragEvent) {
  const target = event.currentTarget as HTMLElement
  const nextTarget = event.relatedTarget as Node | null
  if (!nextTarget || !target.contains(nextTarget)) {
    isResourcePackDragOver.value = false
  }
}

async function handleResourcePackDrop(event: DragEvent) {
  const file = getDroppedZip(event)
  if (!file) return

  event.preventDefault()
  isResourcePackDragOver.value = false
  await loadResourcePack(file)
}
</script>

<template>
  <div
    class="app"
    :class="{ 'app--resource-pack-drop-active': isResourcePackDragOver }"
    @dragover="handleResourcePackDragOver"
    @dragleave="handleResourcePackDragLeave"
    @drop="handleResourcePackDrop"
  >
    <Toolbar />
    <ValidationBanner />

    <div class="app__body">
      <!-- 左パネル -->
      <div class="sidebar">
        <div class="sidebar__section sidebar__section--meta">
          <MetadataPanel />
        </div>
        <div class="sidebar__divider" />
        <div class="sidebar__section sidebar__section--camera">
          <CameraPanel />
        </div>
        <div class="sidebar__divider" />
        <div class="sidebar__section sidebar__section--objects">
          <ObjectList />
        </div>
      </div>

      <!-- 右プレビュー -->
      <div class="preview-area">
        <PreviewCanvas />
      </div>

      <ObjectEditor />
    </div>

    <Timeline />
    <ExportPanel />

    <div v-if="isResourcePackDragOver" class="resource-pack-drop">
      <div class="resource-pack-drop__panel">
        <div class="resource-pack-drop__icon" aria-hidden="true">ZIP</div>
        <div class="resource-pack-drop__title">{{ t('resourcePack.dropTitle') }}</div>
        <div class="resource-pack-drop__hint">{{ t('resourcePack.dropHint') }}</div>
      </div>
    </div>
  </div>
</template>

<style>
:root {
  --bg-1: #0f1117;
  --bg-2: #161b22;
  --bg-3: #1e2530;
  --border: #2a3340;
  --text: #cdd9e5;
  --text-muted: #636e7b;
  --accent: #57ab5a;
  --error: #e5534b;
  --warning: #d4a72c;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

body {
  background: var(--bg-1);
  color: var(--text);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

button {
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
  border: none;
  background: none;
  color: inherit;
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border-radius: 5px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity 0.15s, background 0.15s;
  white-space: nowrap;
  text-decoration: none;
}

.btn--primary {
  background: var(--accent);
  color: #0f1117;
  border-color: var(--accent);
}

.btn--primary:hover:not(:disabled) { opacity: 0.85; }

.btn--secondary {
  background: var(--bg-3);
  color: var(--text);
  border-color: var(--border);
}

.btn--secondary:hover:not(:disabled) { border-color: var(--accent); }

.btn--ghost {
  background: transparent;
  color: var(--text-muted);
  border-color: var(--border);
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
}

.btn--ghost:hover { color: var(--text); border-color: var(--text-muted); }
</style>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--bg-1);
}

.app__body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sidebar {
  width: 240px;
  min-width: 200px;
  flex-shrink: 0;
  background: var(--bg-2);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar__section { overflow: hidden; display: flex; flex-direction: column; }
.sidebar__section--meta    { flex-shrink: 0; }
.sidebar__section--camera  { flex-shrink: 0; }
.sidebar__section--objects { flex: 1; min-height: 0; overflow-y: auto; }

.sidebar__divider { height: 1px; background: var(--border); flex-shrink: 0; }

.preview-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.app--resource-pack-drop-active {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.resource-pack-drop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background: rgb(15 17 23 / 0.55);
}

.resource-pack-drop__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  min-width: min(360px, calc(100vw - 2rem));
  padding: 1rem 1.25rem;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: var(--bg-2);
  box-shadow: 0 18px 60px rgb(0 0 0 / 0.45);
  text-align: center;
}

.resource-pack-drop__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 32px;
  border: 1px solid color-mix(in srgb, var(--accent) 58%, var(--border));
  border-radius: 5px;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
}

.resource-pack-drop__title {
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 700;
}

.resource-pack-drop__hint {
  color: var(--text-muted);
  font-size: 0.76rem;
}
</style>
