import { onMounted, onUnmounted } from 'vue'

/** Stop the decorative header while hidden; do not alter user motion preferences. */
export function useDecorativeVisibility() {
  const update = () => { document.documentElement.dataset.appHidden = String(document.hidden) }
  onMounted(() => {
    update()
    document.addEventListener('visibilitychange', update)
  })
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', update)
    delete document.documentElement.dataset.appHidden
  })
}
