<script setup lang="ts">
import { computed } from "vue"
import { useAppState } from "../composables/useAppState"
import { useI18n } from "../i18n"

const { currentTick, totalTicks, totalFrames, ticksPerFrame, isPlaying, setTick, togglePlay, stopPlay } = useAppState()
const { t } = useI18n()

const currentFrame = computed( () =>
  Math.min( totalFrames.value, Math.round( currentTick.value / ticksPerFrame.value ) )
)
const currentTickLabel = computed( () =>
  Number.isInteger( currentTick.value ) ? String( currentTick.value ) : currentTick.value.toFixed( 2 )
)
const tickLabel = computed(
  () =>
    `frame: ${ currentFrame.value } / ${ totalFrames.value } | tick: ${ currentTickLabel.value } / ${ totalTicks.value }`
)

function onScrub( e: Event ) {
  setTick( +( e.target as HTMLInputElement ).value )
}

function goStart() {
  stopPlay()
  setTick( 0 )
}
function goEnd() {
  stopPlay()
  setTick( totalTicks.value )
}
function stepBack() {
  stopPlay()
  setTick( currentTick.value - ticksPerFrame.value )
}
function stepFwd() {
  stopPlay()
  setTick( currentTick.value + ticksPerFrame.value )
}
</script>

<template>
  <div class="timeline">
    <div class="timeline__controls">
      <button class="ctrl-btn" :title="t('timeline.start')" @click="goStart">⏮</button>
      <button class="ctrl-btn" title="-1 frame" @click="stepBack">
        <span class="step-icon step-icon--back" aria-hidden="true">
          <span class="step-icon__triangle"></span>
          <span class="step-icon__bar"></span>
        </span>
      </button>
      <button class="ctrl-btn play" :class="{ playing: isPlaying }" @click="togglePlay">
        {{ isPlaying ? '⏸' : '▶' }}
      </button>
      <button class="ctrl-btn" title="+1 frame" @click="stepFwd">
        <span class="step-icon step-icon--fwd" aria-hidden="true">
          <span class="step-icon__bar"></span>
          <span class="step-icon__triangle"></span>
        </span>
      </button>
      <button class="ctrl-btn" :title="t('timeline.end')" @click="goEnd">⏭</button>
    </div>

    <input
      class="timeline__scrubber"
      type="range"
      min="0"
      :max="totalTicks"
      :step="ticksPerFrame"
      :value="currentTick"
      @input="onScrub"
    />

    <span class="timeline__label">{{ tickLabel }}</span>
  </div>
</template>

<style scoped>
.timeline {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;
  height: 44px;
  background: var(--bg-2);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.timeline__controls {
  display: flex;
  gap: 0.25rem;
}

.ctrl-btn {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-3);
  color: var(--text);
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s, border-color 0.1s;
}

.ctrl-btn:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 15%, var(--bg-3));
}

.ctrl-btn.play.playing {
  border-color: var(--accent);
  color: var(--accent);
}

.step-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 14px;
  height: 12px;
}

.step-icon__bar {
  width: 2px;
  height: 14px;
  border-radius: 1px;
  background: currentColor;
}

.step-icon__triangle {
  width: 0;
  height: 0;
  border-top: 7px solid transparent;
  border-bottom: 7px solid transparent;
}

.step-icon--back .step-icon__triangle {
  border-right: 10px solid currentColor;
}

.step-icon--fwd .step-icon__triangle {
  border-left: 10px solid currentColor;
}

.timeline__scrubber {
  flex: 1;
  accent-color: var(--accent);
}

.timeline__label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 120px;
}
</style>
