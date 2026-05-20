<script setup lang="ts">
import { useAppState } from '../composables/useAppState'
import { useI18n } from '../i18n'
import ObjectIcon from './ObjectIcon.vue'

const { schema, selectedObjectIds, selectObject } = useAppState()
const { t } = useI18n()

function handleObjectClick(event: MouseEvent, id: string) {
  selectObject(id, event.ctrlKey || event.metaKey)
}
</script>

<template>
  <aside class="panel">
    <div class="panel__title">{{ t('objects.title') }}</div>

    <div v-if="schema && schema.objects.length > 0" class="obj-list">
      <div
        v-for="obj in schema.objects"
        :key="obj.id"
        class="obj-item"
        :class="{ 'obj-item--selected': selectedObjectIds.includes(obj.id) }"
        role="button"
        tabindex="0"
        :aria-pressed="selectedObjectIds.includes(obj.id)"
        @click="handleObjectClick($event, obj.id)"
        @keydown.enter.prevent="selectObject(obj.id)"
        @keydown.space.prevent="selectObject(obj.id)"
      >
        <ObjectIcon :object="obj" />
        <span class="obj-id">{{ obj.id }}</span>
        <span class="obj-kf">{{ obj.keyframes.length }} kf</span>
      </div>
    </div>

    <div v-else class="empty-state">{{ t('objects.empty') }}</div>
  </aside>
</template>

<style scoped>
.panel {
  padding: 0.75rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.panel__title {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 0.75rem;
}

.obj-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.obj-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.4rem;
  border-radius: 4px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s;
}

.obj-item:hover {
  border-color: var(--text-muted);
}

.obj-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.obj-item--selected {
  background: rgba(87, 171, 90, 0.18);
  border-color: var(--accent);
}

.obj-id {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.obj-kf {
  font-size: 0.65rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.empty-state {
  font-size: 0.78rem;
  color: var(--text-muted);
}
</style>
