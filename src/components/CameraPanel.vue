<script setup lang="ts">
import { useAppState } from '../composables/useAppState'
import { useI18n } from '../i18n'

const { cameraObjects, activeCameraId, setActiveCameraId } = useAppState()
const { t } = useI18n()
</script>

<template>
  <aside class="panel">
    <div class="panel__title">{{ t('camera.title') }}</div>

    <div v-if="cameraObjects.length > 0" class="cam-list">
      <button
        v-for="cam in cameraObjects"
        :key="cam.id"
        class="cam-item"
        :class="{ active: cam.id === activeCameraId }"
        @click="setActiveCameraId(cam.id)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M20.188 10.934a8 8 0 01-16.376 0L2 11a10 10 0 0020 0z"/></svg>
        {{ cam.id }}
      </button>
    </div>

    <div v-else class="empty-state">{{ t('camera.empty') }}</div>
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

.cam-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cam-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  border-radius: 4px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, color 0.15s;
}

.cam-item:hover {
  border-color: var(--accent);
  color: var(--text);
}

.cam-item.active {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-3));
}

.empty-state {
  font-size: 0.78rem;
  color: var(--text-muted);
}
</style>
