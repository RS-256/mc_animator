<script setup lang="ts">
import { useAppState } from '../composables/useAppState'
import { useI18n } from '../i18n'

const { validation } = useAppState()
const { t } = useI18n()
</script>

<template>
  <div v-if="validation && validation.messages.length > 0" class="validation-banner">
    <div
      v-for="(msg, i) in validation.messages"
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

.val-msg {
  display: flex;
  align-items: center;
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
