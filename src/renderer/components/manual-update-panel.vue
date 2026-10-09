<template>
  <Teleport to="body">
    <dialog ref="panel" class="update-dialog" data-update-dialog :aria-labelledby="titleId" @cancel="cancel" @click="backdrop">
      <header>
        <h2 :id="titleId">{{ t('updatesTitle') }}</h2>
        <button type="button" class="update-icon" :aria-label="t('updatesClose')" @click="close">×</button>
      </header>
      <div class="update-body">
        <div class="update-version"><span>{{ t('updatesInstalled') }}</span><strong>v{{ currentVersion }}</strong></div>
        <p>{{ t('updatesOptional') }}</p>
        <div class="update-status" :class="{ 'update-status--error': failed }" role="status" aria-live="polite" data-update-status>
          {{ checking ? t('updatesChecking') : failed ? t('updatesError') : t('updates_' + (result?.status ?? 'idle')) }}
          <strong v-if="result?.latestVersion">v{{ result.latestVersion }}</strong>
        </div>
        <p v-if="result?.status === 'available' && !result.downloadUrl">{{ t('updatesNoInstaller') }}</p>
        <p class="update-note">{{ t('updatesInstallHelp') }}</p>
      </div>
      <footer>
        <button type="button" class="update-button update-button--primary" :disabled="checking || opening" data-update-check @click="check">{{ checking ? t('updatesChecking') : t('updatesCheck') }}</button>
        <button v-if="result?.status === 'available' && result.downloadUrl" type="button" class="update-button update-button--primary" :disabled="opening" data-update-download @click="download">{{ t('updatesDownload') }}</button>
        <button type="button" class="update-button" :disabled="opening" data-update-release @click="release">{{ t('updatesRelease') }}</button>
        <button type="button" class="update-button" data-update-later @click="close">{{ t('updatesLater') }}</button>
      </footer>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { UpdateInfo } from '../../manual-updates'
const props = defineProps<{
  open: boolean; currentVersion: string; t: (key: string) => string
  api: { check: () => Promise<UpdateInfo>; download: () => Promise<void>; release: () => Promise<void> }
}>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const panel = ref<HTMLDialogElement>()
const result = ref<UpdateInfo>()
const checking = ref(false), opening = ref(false), failed = ref(false)
const titleId = 'manual-update-title'
let request = 0

async function check() {
  if (checking.value) return
  const current = ++request
  checking.value = true; failed.value = false; result.value = undefined
  try {
    const info = await props.api.check()
    if (current === request) result.value = info
  } catch { if (current === request) failed.value = true }
  finally { if (current === request) checking.value = false }
}
async function openLink(action: () => Promise<void>) {
  opening.value = true; failed.value = false
  try { await action() } catch { failed.value = true }
  finally { opening.value = false }
}
function download() { void openLink(props.api.download) }
function release() { void openLink(props.api.release) }
function close() { emit('update:open', false) }
function cancel(event: Event) { event.preventDefault(); close() }
function backdrop(event: MouseEvent) {
  if (event.target !== panel.value) return
  const box = panel.value.getBoundingClientRect()
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close()
}
watch(() => props.open, open => {
  if (open) {
    failed.value = false; result.value = undefined
    panel.value?.showModal()
  } else {
    ++request; checking.value = false; panel.value?.close()
  }
}, { flush: 'post' })
onBeforeUnmount(() => { ++request; panel.value?.close() })
</script>

<style scoped>
.update-dialog { box-sizing: border-box; width: min(540px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); padding: 0; border: 1px solid #385364; border-radius: 16px; background: #10242f; color: #edf5f7; box-shadow: 0 24px 90px #0009; }
.update-dialog[open] { display: flex; flex-direction: column; overflow: hidden; }
.update-dialog::backdrop { background: #051017bf; backdrop-filter: blur(4px); }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 22px; flex-shrink: 0; border-bottom: 1px solid #385364; }
h2 { margin: 0; font-size: 21px; }
.update-icon { border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 26px; width: 36px; height: 36px; border-radius: 8px; }
.update-body { padding: 20px 22px; overflow-y: auto; min-height: 0; line-height: 1.5; }
.update-version { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; }
.update-version strong { color: #80dcd2; }
p { margin: 14px 0; }
.update-status { padding: 14px; background: #1b3545; border: 1px solid #385364; border-radius: 10px; }
.update-status strong { display: block; margin-top: 8px; }
.update-status--error { border-color: #d89670; color: #ffd2b3; }
.update-note { color: #b6cad4; font-size: 13px; margin-bottom: 0; }
footer { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px 22px; border-top: 1px solid #385364; flex-shrink: 0; }
.update-button { box-sizing: border-box; min-height: 40px; border: 1px solid #385364; border-radius: 9px; background: #1b3545; color: #edf5f7; font: inherit; padding: 9px 14px; cursor: pointer; white-space: normal; }
.update-button--primary { color: #082326; background: #80dcd2; border-color: #80dcd2; font-weight: 700; }
button:disabled { opacity: .6; cursor: wait; }
button:hover:not(:disabled) { filter: brightness(1.12); }
button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
</style>
