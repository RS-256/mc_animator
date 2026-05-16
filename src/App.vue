<script setup lang="ts">
import Toolbar from './components/Toolbar.vue'
import ValidationBanner from './components/ValidationBanner.vue'
import MetadataPanel from './components/MetadataPanel.vue'
import CameraPanel from './components/CameraPanel.vue'
import ObjectList from './components/ObjectList.vue'
import PreviewCanvas from './components/PreviewCanvas.vue'
import Timeline from './components/Timeline.vue'
import ExportPanel from './components/ExportPanel.vue'
</script>

<template>
  <div class="app">
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
    </div>

    <Timeline />
    <ExportPanel />
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
</style>
