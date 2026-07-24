<script setup lang="ts">
import { computed } from "vue"
import { useAppState } from "../composables/useAppState"
import { useI18n } from "../i18n"

const { validation, dismissValidation } = useAppState()
const { t } = useI18n()

const messages = computed( () => validation.value?.messages ?? [] )
const hasErrors = computed( () => messages.value.some( ( msg ) => msg.severity === "error" ) )
</script>

<template>
  <div
    v-if="validation && validation.messages.length > 0 && hasErrors"
    class="validation-modal"
    role="alertdialog"
    aria-modal="true"
  >
    <div class="validation-modal__panel">
      <div class="validation-modal__header">
        <div class="validation-modal__title">{{ t('validation.title') }}</div>
        <button class="validation-modal__close" type="button" @click="dismissValidation">
          {{ t('validation.close') }}
        </button>
      </div>
      <div class="validation-modal__list">
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="val-msg"
          :class="msg.severity"
        >
          <span class="val-icon">{{ msg.severity === 'error' ? '✖' : '⚠' }}</span>
          <span>{{ msg.messageKey ? t(msg.messageKey, msg.params) : msg.message }}</span>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="validation && validation.messages.length > 0" class="validation-banner">
    <div class="validation-banner__header">
      <span>{{ t('validation.warningTitle') }}</span>
      <button type="button" @click="dismissValidation">{{ t('validation.close') }}</button>
    </div>
    <div
      v-for="(msg, i) in messages"
      :key="i"
      class="val-msg"
      :class="msg.severity"
    >
      <span class="val-icon">{{ msg.severity === 'error' ? '✖' : '⚠' }}</span>
      {{ msg.messageKey ? t(msg.messageKey, msg.params) : msg.message }}
    </div>
  </div>
</template>

<style scoped>
.validation-banner {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.4rem 1rem;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  max-height: 100px;
  overflow-y: auto;
}

.validation-banner__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--warning);
  font-size: 0.75rem;
  font-weight: 700;
}

.validation-banner__header button {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.validation-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgb(15 17 23 / 0.72);
}

.validation-modal__panel {
  width: min(620px, 100%);
  max-height: min(70vh, 560px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-2);
  border: 1px solid color-mix(in srgb, var(--error) 42%, var(--border));
  border-radius: 8px;
  box-shadow: 0 18px 60px rgb(0 0 0 / 0.45);
}

.validation-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border);
}

.validation-modal__title {
  color: var(--error);
  font-size: 0.95rem;
  font-weight: 700;
}

.validation-modal__close {
  flex-shrink: 0;
  padding: 0.3rem 0.65rem;
  color: var(--text);
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 0.78rem;
}

.validation-modal__close:hover {
  border-color: var(--text-muted);
}

.validation-modal__list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.85rem 1rem 1rem;
  overflow-y: auto;
}

.val-msg {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  font-size: 0.75rem;
  padding: 0.15rem 0;
}

.val-msg.error {
  color: var(--error);
}

.val-msg.warning {
  color: var(--warning);
}

.val-icon {
  flex-shrink: 0;
}
</style>
