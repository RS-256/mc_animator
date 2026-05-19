<script setup lang="ts">
import { useAppState } from '../composables/useAppState'
import { useI18n, type LanguageKey } from '../i18n'

const { loadJson, loadResourcePack } = useAppState()
const { language, languageOptions, t } = useI18n()

function onJsonInput(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) loadJson(file)
  input.value = ''
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

function onLanguageChange(e: Event) {
  language.value = (e.target as HTMLSelectElement).value as LanguageKey
}
</script>

<template>
  <header class="toolbar">
    <span class="toolbar__logo">⛏ MC Animator</span>

    <div class="toolbar__actions">
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

      <!-- JSON 読込 -->
      <label class="btn btn--primary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        {{ t('toolbar.loadJson') }}
        <input type="file" accept=".json" style="display:none" @change="onJsonInput" />
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
</style>
