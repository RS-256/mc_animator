<script setup lang="ts">
import { useAppState } from '../composables/useAppState'

const { loadJson, loadResourcePack } = useAppState()

function onJsonInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) loadJson(file)
}

function onZipInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) loadResourcePack(file)
}

function onZipDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files[0]
  if (file && file.name.endsWith('.zip')) loadResourcePack(file)
}
</script>

<template>
  <header class="toolbar">
    <span class="toolbar__logo">⛏ MC Animator</span>

    <div class="toolbar__actions">
      <!-- JSON 読込 -->
      <label class="btn btn--primary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        JSON を読み込む
        <input type="file" accept=".json" style="display:none" @change="onJsonInput" />
      </label>

      <!-- リソースパック -->
      <label
        class="btn btn--secondary"
        @dragover.prevent
        @drop="onZipDrop"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10H3M16 2l5 5-5 5M8 22l-5-5 5-5"/></svg>
        リソースパック
        <input type="file" accept=".zip" style="display:none" @change="onZipInput" />
      </label>
    </div>
  </header>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1rem;
  height: 48px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.toolbar__logo {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.02em;
  margin-right: auto;
}

.toolbar__actions {
  display: flex;
  gap: 0.5rem;
}
</style>
