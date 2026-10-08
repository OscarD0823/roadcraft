<template>
  <section class="game-brief" data-game-brief="roadcraft" :aria-label="t('operationTitle')">
    <div class="game-brief__copy">
      <span class="eyebrow">{{ t('operationLabel') }}</span>
      <h1>{{ t('operationTitle') }}</h1>
      <p>{{ t('operationHelp') }}</p>
      <ol class="operation-route" :aria-label="t('operationFlow')">
        <li v-for="(step, index) in steps" :key="step"><b>{{ String(index + 1).padStart(2, '0') }}</b>{{ t(step) }}</li>
      </ol>
    </div>
    <div class="game-brief__scene"><StartupJourney loop :paint="paint" /><span>{{ t('operationScene') }}</span></div>
  </section>
</template>
<script setup lang="ts">
import StartupJourney from './startup-journey.vue'
import type { CompanyPaint } from '../../shared'
defineProps<{ t: (key: string) => string; paint?: CompanyPaint }>()
const steps = ['operationClear', 'operationBuild', 'operationConnect']
</script>
