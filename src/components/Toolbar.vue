<script setup lang="ts">
import { ref } from "vue"
import { useAppState } from "../composables/useAppState"
import { useI18n, type LanguageKey } from "../i18n"

const { schema, sourceJsonFileName, isSchemaDirty, loadJson, createNewJson, markSchemaSaved, loadResourcePack } =
  useAppState()
const { language, languageOptions, t } = useI18n()
const isFileMenuOpen = ref( false )
const isNewConfirmOpen = ref( false )

function onJsonInput( e: Event ) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[ 0 ]
  if ( file ) loadJson( file )
  isFileMenuOpen.value = false
  input.value = ""
}

function onZipInput( e: Event ) {
  const file = ( e.target as HTMLInputElement ).files?.[ 0 ]
  if ( file ) loadResourcePack( file )
}

function onZipDrop( e: DragEvent ) {
  e.preventDefault()
  const file = e.dataTransfer?.files[ 0 ]
  if ( file && file.name.endsWith( ".zip" ) ) loadResourcePack( file )
}

function onLanguageChange( e: Event ) {
  language.value = ( e.target as HTMLSelectElement ).value as LanguageKey
}

function handleCreateNewJson() {
  if ( isSchemaDirty.value ) {
    isFileMenuOpen.value = false
    isNewConfirmOpen.value = true
    return
  }

  createNewJson()
  isFileMenuOpen.value = false
}

function confirmCreateNewJson() {
  createNewJson()
  isNewConfirmOpen.value = false
}

function cancelCreateNewJson() {
  isNewConfirmOpen.value = false
  isFileMenuOpen.value = false
}

function downloadJson() {
  if ( ! schema.value ) return

  const json = JSON.stringify( schema.value, null, 2 )
  const blob = new Blob( [ json ], { type: "application/json" } )
  const url = URL.createObjectURL( blob )
  const link = document.createElement( "a" )
  link.href = url
  link.download = sourceJsonFileName.value ?? "animation.json"
  link.click()
  URL.revokeObjectURL( url )
  markSchemaSaved()
  isFileMenuOpen.value = false
}
</script>

<template>
  <header class="toolbar">
    <span class="toolbar__logo">⛏ MC Animator</span>

    <div class="toolbar__actions">
      <div class="file-menu">
        <button
          type="button"
          class="btn btn--secondary"
          :aria-expanded="isFileMenuOpen"
          @click="isFileMenuOpen = !isFileMenuOpen"
        >
          {{ t('toolbar.file') }}
          <span class="file-menu__caret" aria-hidden="true">▾</span>
        </button>

        <div v-if="isFileMenuOpen" class="file-menu__popover">
          <button type="button" class="file-menu__item" @click="handleCreateNewJson">
            {{ t('toolbar.newJson') }}
          </button>

          <label class="file-menu__item">
            {{ t('toolbar.loadJson') }}
            <input type="file" accept=".json" style="display:none" @change="onJsonInput" />
          </label>

          <button
            type="button"
            class="file-menu__item"
            :disabled="!schema"
            @click="downloadJson"
          >
            {{ t('toolbar.downloadJson') }}
          </button>
        </div>
      </div>

      <label class="language-select" :title="t('language.label')">
        <span>{{ t('language.label') }}</span>
        <select :value="language" @change="onLanguageChange">
          <option
            v-for="option in languageOptions"
            :key="option.key"
            :value="option.key"
          >
            {{ t(option.labelKey) }}
          </option>
        </select>
      </label>

      <!-- リソースパック -->
      <label
        class="btn btn--secondary"
        @dragover.prevent
        @drop="onZipDrop"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10H3M16 2l5 5-5 5M8 22l-5-5 5-5"/></svg>
        {{ t('toolbar.resourcePack') }}
        <input type="file" accept=".zip" style="display:none" @change="onZipInput" />
      </label>
    </div>

    <div
      v-if="isNewConfirmOpen"
      class="confirm-modal"
      role="alertdialog"
      aria-modal="true"
      :aria-label="t('toolbar.newJsonConfirmTitle')"
      @click.self="cancelCreateNewJson"
    >
      <div class="confirm-modal__panel">
        <div class="confirm-modal__header">
          <div class="confirm-modal__title">{{ t('toolbar.newJsonConfirmTitle') }}</div>
        </div>
        <div class="confirm-modal__body">
          <div class="confirm-msg warning">
            <span class="confirm-icon">⚠</span>
            <span>{{ t('toolbar.newJsonConfirmMessage') }}</span>
          </div>
        </div>
        <div class="confirm-modal__footer">
          <button class="confirm-button confirm-button--secondary" type="button" @click="cancelCreateNewJson">
            {{ t('toolbar.newJsonCancel') }}
          </button>
          <button class="confirm-button confirm-button--danger" type="button" @click="confirmCreateNewJson">
            {{ t('toolbar.newJsonDiscard') }}
          </button>
        </div>
      </div>
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
  align-items: center;
  gap: 0.5rem;
}

.file-menu {
  position: relative;
}

.file-menu__caret {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.file-menu__popover {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  z-index: 40;
  min-width: 160px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-2);
  box-shadow: 0 12px 36px rgb(0 0 0 / 0.35);
}

.file-menu__item {
  width: 100%;
  display: flex;
  align-items: center;
  min-height: 32px;
  padding: 0.35rem 0.65rem;
  color: var(--text);
  background: transparent;
  font-size: 0.78rem;
  text-align: left;
  white-space: nowrap;
}

.file-menu__item:hover:not(:disabled) {
  background: var(--bg-3);
}

.language-select {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  white-space: nowrap;
}

.language-select select {
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  font-size: 0.78rem;
  padding: 0.26rem 0.45rem;
  cursor: pointer;
}

.language-select select:focus {
  outline: none;
  border-color: var(--accent);
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
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border);
}

.confirm-modal__title {
  color: var(--warning);
  font-size: 0.95rem;
  font-weight: 700;
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

.confirm-button--danger {
  border-color: color-mix(in srgb, var(--error) 55%, var(--border));
  color: var(--error);
}

.confirm-button--danger:hover {
  background: color-mix(in srgb, var(--error) 12%, var(--bg-3));
}
</style>
