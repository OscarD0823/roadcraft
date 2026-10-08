<template>
  <div class="workspace-identity" data-workspace-identity="roadcraft">
    <span class="workspace-identity__tagline" :title="t('operationHelp')">{{ t('operationTitle') }}</span>
    <StartupJourney loop :paint="paint" class="workspace-journey" />
  </div>
</template>
<script setup lang="ts">
import StartupJourney from './startup-journey.vue'
import type { CompanyPaint } from '../../shared'
defineProps<{ t: (key: string) => string; paint?: CompanyPaint }>()
</script>
