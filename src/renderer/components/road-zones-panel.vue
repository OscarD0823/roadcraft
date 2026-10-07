<template>
  <dialog ref="panel" class="road-dialog" @cancel="cancel" @click="backdrop">
    <header>
      <div><small>{{ t('roadExperimental') }}</small><h2>{{ t('freeRoads') }}</h2></div>
      <button class="icon-button" :disabled="busy" :aria-label="t('roadClose')" @click="close">×</button>
    </header>
    <div class="road-dialog__body">
      <p v-if="errorMessage" class="road-warning" role="alert" data-road-error>{{ errorMessage }}</p>
      <p>{{ t('freeRoadsHelp') }}</p>
      <div class="road-status" :class="{ 'road-status--enabled': state?.status === 'enabled' }" role="status">
        {{ busy ? t('saving') : t(`roadStatus_${state?.status ?? 'loading'}`) }}
      </div>
      <p v-if="state?.message" class="road-warning">{{ state.message }}</p>
      <section class="road-warning"><strong>{{ t('roadLimitsTitle') }}</strong><p>{{ t('roadLimits') }}</p></section>
      <section><strong>{{ t('roadRestoreTitle') }}</strong><p>{{ t('roadRestoreHelp') }}</p></section>
      <details v-if="state?.backupPath"><summary>{{ t('roadBackup') }}</summary><code>{{ state.backupPath }}</code></details>
    </div>
    <footer>
      <button v-if="state?.status === 'enabled'" class="button button--secondary" :disabled="busy" data-road-restore @click="change(false)">{{ t('roadRestore') }}</button>
      <button v-else class="button button--primary" :disabled="busy || state?.status !== 'standard'" data-road-enable @click="change(true)">{{ t('roadEnable') }}</button>
      <button class="button button--secondary" :disabled="busy" @click="refresh">↻ {{ t('roadCheck') }}</button>
    </footer>
  </dialog>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { RoadZoneStatus } from '../../shared'
const props = defineProps<{ open: boolean; t: (key: string) => string; checkedAt?: number }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; status: [value: RoadZoneStatus]; error: [value: unknown] }>()
const panel = ref<HTMLDialogElement>()
const state = ref<RoadZoneStatus>()
const busy = ref(false)
const errorMessage = ref('')
let request = 0

function showFailure(error: unknown) {
  errorMessage.value = error instanceof Error ? error.message : String(error)
  panel.value?.querySelector('.road-dialog__body')?.scrollTo({ top: 0 })
}

async function refresh() {
  const current = ++request
  try {
    const result = await window.roadcraft.getRoadZoneStatus()
    if (current !== request) return
    state.value = result; emit('status', result)
  } catch (error) { showFailure(error) }
}
async function change(enabled: boolean) {
  busy.value = true
  errorMessage.value = ''
  try {
    const result = await window.roadcraft.setFreeRoads(enabled)
    if (!result.ok) showFailure(new Error(result.message))
  } catch (error) { showFailure(error) }
  finally { await refresh(); busy.value = false }
}
function close() { if (!busy.value) emit('update:open', false) }
function cancel(event: Event) { event.preventDefault(); close() }
function backdrop(event: MouseEvent) {
  if (event.target !== panel.value) return
  const rect = panel.value.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close()
}
watch(() => props.open, open => {
  if (open) { errorMessage.value = ''; panel.value?.showModal(); void refresh() }
  else panel.value?.close()
})
onMounted(refresh)
watch(() => props.checkedAt, refresh)
</script>

<style scoped>
.road-dialog { width: min(600px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); padding: 0; border: 1px solid #334155; border-radius: 20px; background: #f8fafc; color: #182536; box-shadow: 0 24px 90px #0006; }
.road-dialog[open] { display: flex; flex-direction: column; overflow: hidden; }
.road-dialog::backdrop { background: #070e1ac9; backdrop-filter: blur(5px); }
header { display: flex; flex-shrink: 0; align-items: center; justify-content: space-between; gap: 16px; padding: 22px 24px; background: #101c2e; color: white; }
header small { color: #ffb875; font-weight: 750; letter-spacing: .1em; }
h2 { margin: 6px 0 0; font-size: 26px; }
.road-dialog__body { padding: 20px 24px; line-height: 1.6; min-height: 0; overflow-y: auto; }
p { margin: 8px 0 18px; }
.road-status { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; font-weight: 750; margin-bottom: 16px; }
.road-status--enabled { background: #e1f4e9; border-color: #93bea7; color: #225c40; }
.road-warning { background: #fff2df; border: 1px solid #e6bd88; border-radius: 12px; padding: 14px; }
.road-warning p { margin-bottom: 0; }
section { margin: 16px 0; }
code { display: block; overflow-wrap: anywhere; font-size: 12px; margin-top: 8px; }
footer { display: flex; flex-shrink: 0; flex-wrap: wrap; gap: 10px; padding: 16px 24px; border-top: 1px solid #dce3ec; }
button { white-space: normal; }
@media (prefers-reduced-motion: no-preference) { .road-dialog[open] { animation: road-enter .22s ease-out; } @keyframes road-enter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } }
</style>
