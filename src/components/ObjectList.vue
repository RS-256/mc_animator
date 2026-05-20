<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppState } from '../composables/useAppState'
import { useI18n } from '../i18n'
import type { SceneObject } from '../types/schema'
import ObjectIcon from './ObjectIcon.vue'

const { schema, selectedObjectIds, selectObject, clearObjectSelection, addObject, deleteSelectedObjects } = useAppState()
const { t } = useI18n()
const isDeleteConfirmOpen = ref(false)
const isAddPanelOpen = ref(false)
const newObjectId = ref('')
const newObjectType = ref<SceneObject['type']>('block')
const hasSubmittedAdd = ref(false)
const objectTypes = ['block', 'camera'] as const

const trimmedNewObjectId = computed(() => newObjectId.value.trim())
const existingObjectIds = computed(() => new Set(schema.value?.objects.map(object => object.id) ?? []))
const newObjectIdError = computed(() => {
  if (!hasSubmittedAdd.value && trimmedNewObjectId.value.length === 0) return ''
  if (trimmedNewObjectId.value.length === 0) return t('objects.addIdRequired')
  if (existingObjectIds.value.has(trimmedNewObjectId.value)) {
    return t('objects.addIdDuplicate', { id: trimmedNewObjectId.value })
  }
  return ''
})

function handleObjectClick(event: MouseEvent, id: string) {
  selectObject(id, event.ctrlKey || event.metaKey)
}

function openAddPanel() {
  if (!schema.value) return
  isAddPanelOpen.value = true
  hasSubmittedAdd.value = false
  newObjectId.value = ''
  newObjectType.value = 'block'
  clearObjectSelection()
}

function closeAddPanel() {
  isAddPanelOpen.value = false
  hasSubmittedAdd.value = false
}

function submitAddObject() {
  hasSubmittedAdd.value = true
  if (newObjectIdError.value) return

  if (addObject(trimmedNewObjectId.value, newObjectType.value)) {
    closeAddPanel()
  }
}

function handleDeleteSelectedObjects() {
  if (selectedObjectIds.value.length === 0) return
  isDeleteConfirmOpen.value = true
}

function cancelDeleteSelectedObjects() {
  isDeleteConfirmOpen.value = false
}

function confirmDeleteSelectedObjects() {
  deleteSelectedObjects()
  isDeleteConfirmOpen.value = false
}
</script>

<template>
  <aside class="panel">
    <div class="panel__header">
      <div class="panel__title">{{ t('objects.title') }}</div>
      <div class="panel__actions" aria-label="Object actions">
        <button
          type="button"
          class="icon-button"
          :aria-label="t('objects.add')"
          :title="t('objects.add')"
          :disabled="!schema || isAddPanelOpen"
          @click="openAddPanel"
        >
          +
        </button>
        <button
          type="button"
          class="icon-button"
          :aria-label="t('objects.delete')"
          :title="t('objects.delete')"
          :disabled="selectedObjectIds.length === 0 || isAddPanelOpen"
          @click="handleDeleteSelectedObjects"
        >
          -
        </button>
      </div>
    </div>

    <form v-if="isAddPanelOpen" class="add-panel" @submit.prevent="submitAddObject">
      <label class="field">
        <span class="field__label">{{ t('objects.addId') }}</span>
        <input
          v-model="newObjectId"
          class="field__input"
          type="text"
          autocomplete="off"
          :placeholder="t('objects.addIdPlaceholder')"
          :aria-invalid="Boolean(newObjectIdError)"
          autofocus
        >
      </label>
      <div v-if="newObjectIdError" class="field-error">{{ newObjectIdError }}</div>

      <div class="field">
        <span class="field__label">{{ t('objects.addType') }}</span>
        <div class="type-control">
          <label
            v-for="type in objectTypes"
            :key="type"
            class="type-option"
            :class="{ 'type-option--active': newObjectType === type }"
          >
            <input v-model="newObjectType" type="radio" :value="type">
            <span>{{ t(type === 'block' ? 'objects.typeBlock' : 'objects.typeCamera') }}</span>
          </label>
        </div>
      </div>

      <div class="add-panel__actions">
        <button class="form-button form-button--secondary" type="button" @click="closeAddPanel">
          {{ t('objects.addCancel') }}
        </button>
        <button class="form-button form-button--primary" type="submit">
          {{ t('objects.addRegister') }}
        </button>
      </div>
    </form>

    <div v-else-if="schema && schema.objects.length > 0" class="obj-list">
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

    <div
      v-if="isDeleteConfirmOpen"
      class="confirm-modal"
      role="alertdialog"
      aria-modal="true"
      :aria-label="t('objects.deleteConfirmTitle')"
      @click.self="cancelDeleteSelectedObjects"
    >
      <div class="confirm-modal__panel">
        <div class="confirm-modal__header">
          <div class="confirm-modal__title">{{ t('objects.deleteConfirmTitle') }}</div>
        </div>
        <div class="confirm-modal__body">
          <div class="confirm-msg warning">
            <span class="confirm-icon">⚠</span>
            <span>{{ t('objects.deleteConfirm', { count: selectedObjectIds.length }) }}</span>
          </div>
        </div>
        <div class="confirm-modal__footer">
          <button class="confirm-button confirm-button--secondary" type="button" @click="cancelDeleteSelectedObjects">
            {{ t('objects.deleteCancel') }}
          </button>
          <button class="confirm-button confirm-button--danger" type="button" @click="confirmDeleteSelectedObjects">
            {{ t('objects.deleteConfirmAction') }}
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.panel {
  padding: 0.75rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.panel__title {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.panel__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.icon-button {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-3);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.9rem;
  line-height: 1;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}

.icon-button:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--text);
}

.icon-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
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

.add-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field__label {
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.field__input {
  width: 100%;
  min-height: 30px;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-3);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.76rem;
  outline: none;
}

.field__input:focus {
  border-color: var(--accent);
}

.field__input[aria-invalid="true"] {
  border-color: var(--error);
}

.field-error {
  color: var(--error);
  font-size: 0.72rem;
  margin-top: -0.45rem;
}

.type-control {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem;
}

.type-option {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-3);
  color: var(--text-muted);
  font-size: 0.75rem;
  cursor: pointer;
  user-select: none;
}

.type-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.type-option--active {
  border-color: var(--accent);
  background: rgba(87, 171, 90, 0.18);
  color: var(--text);
}

.add-panel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.form-button {
  min-height: 30px;
  padding: 0.3rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 0.78rem;
}

.form-button--secondary {
  color: var(--text);
  background: var(--bg-3);
}

.form-button--secondary:hover {
  border-color: var(--text-muted);
}

.form-button--primary {
  color: #0f1117;
  background: var(--accent);
  border-color: var(--accent);
}

.form-button--primary:hover {
  opacity: 0.85;
}

.confirm-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgb(15 17 23 / 0.72);
}

.confirm-modal__panel {
  width: min(520px, 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-2);
  border: 1px solid color-mix(in srgb, var(--warning) 42%, var(--border));
  border-radius: 8px;
  box-shadow: 0 18px 60px rgb(0 0 0 / 0.45);
}

.confirm-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border);
}

.confirm-modal__title {
  color: var(--warning);
  font-size: 0.95rem;
  font-weight: 700;
}

.confirm-button {
  flex-shrink: 0;
  padding: 0.3rem 0.65rem;
  color: var(--text);
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 0.78rem;
}

.confirm-button--secondary:hover {
  border-color: var(--text-muted);
}

.confirm-modal__body {
  padding: 0.85rem 1rem 1rem;
}

.confirm-msg {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  font-size: 0.75rem;
  padding: 0.15rem 0;
}

.confirm-msg.warning {
  color: var(--warning);
}

.confirm-icon {
  flex-shrink: 0;
}

.confirm-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0 1rem 1rem;
}

.confirm-button--danger {
  border-color: color-mix(in srgb, var(--error) 55%, var(--border));
  color: var(--error);
}

.confirm-button--danger:hover {
  background: color-mix(in srgb, var(--error) 12%, var(--bg-3));
}
</style>
