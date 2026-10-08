<template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[section] || paths.other" /></svg></template>
<script setup lang="ts">
defineProps<{ section: string }>()
const paths: Record<string, string> = {
  all: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  truck: 'M2 7h12v10H2z M14 10h4l4 4v3h-8 M5 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M16 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  trailer: 'M2 6h18v10H2z M20 14h2 M5 16a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M13 16a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  ai: 'M6 3a3 3 0 1 0 0 6a3 3 0 1 0 0-6 M18 15a3 3 0 1 0 0 6a3 3 0 1 0 0-6 M6 9v5a4 4 0 0 0 4 4h5 M11 12l3 3-3 3',
  modified: 'M14 5l5 5 M4 20l5-1L21 7l-4-4L5 15z',
  other: 'M12 3l9 5v8l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v8',
  save: 'M4 3h14l3 3v15H3V3z M7 3v6h10V3 M7 21v-8h10v8'
}
</script>
<style scoped>svg { display: block; width: 20px; height: 20px; flex: none; }</style>
