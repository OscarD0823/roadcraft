<template>
  <div class="app-frame" :dir="locale === 'ar' ? 'rtl' : 'ltr'">
    <header class="topbar">
      <div class="brand">
        <img :src="iconUrl" alt="" class="brand__icon">
        <div>
          <strong>RoadCraft Studio</strong>
          <span>{{ t('appSubtitle') }}</span>
        </div>
      </div>

      <nav class="primary-nav">
        <button
          v-for="item in navigation"
          :key="item.value"
          class="nav-button"
          :class="{ 'nav-button--active': view === item.value }"
          @click="view = item.value"
        >
          <span class="nav-button__icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
          <small>{{ item.count }}</small>
        </button>
      </nav>

      <div class="topbar__actions">
        <label class="language-select" :title="t('language')">
          <span>🌐</span>
          <select v-model="locale" @change="changeLocale">
            <option v-for="item in locales" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
        <button class="icon-button" :title="t('changePath')" @click="chooseInstall">⚙</button>
      </div>
    </header>

    <section class="workspace-hero">
      <div class="workspace-hero__content">
        <span class="eyebrow">ROADCRAFT MOD WORKSPACE</span>
        <h1>{{ currentTitle }}</h1>
        <p>{{ t('libraryHelp') }}</p>
        <div class="path-chip" :title="scanResult?.installPath">
          <span class="status-dot" />
          <strong>{{ t('detectedPath') }}:</strong>
          <span>{{ scanResult?.installPath || '—' }}</span>
        </div>
      </div>

      <div class="workspace-hero__actions">
        <button class="button button--primary" :disabled="loading" @click="scan">
          <span :class="{ spin: loading }">↻</span>
          {{ loading ? t('scanning') : t('scan') }}
        </button>
        <button class="button button--ghost" @click="openSourceFolder">📁 {{ t('openFolder') }}</button>
        <button class="button button--ghost" @click="launchEditor">🛠 {{ t('openEditor') }}</button>
      </div>

      <div class="stats-row">
        <article>
          <strong>{{ scanResult?.entries.length ?? 0 }}</strong>
          <span>{{ t('availableContent') }}</span>
        </article>
        <article>
          <strong>{{ countByKind('truck') }}</strong>
          <span>{{ t('vehicles') }}</span>
        </article>
        <article>
          <strong>{{ countByKind('trailer') }}</strong>
          <span>{{ t('trailers') }}</span>
        </article>
        <article>
          <strong>{{ countByKind('wheel') }}</strong>
          <span>{{ t('wheels') }}</span>
        </article>
        <article>
          <strong>{{ scanResult?.packageCount ?? 0 }}</strong>
          <span>{{ t('modProjects') }}</span>
        </article>
      </div>
    </section>

    <main class="main-shell" :class="{ 'main-shell--inspector': selectedEntry }">
      <section class="library-panel">
        <div class="toolbar">
          <label class="search-box">
            <span>⌕</span>
            <input v-model="search" :placeholder="t('searchPlaceholder')">
          </label>
          <span class="result-label">{{ filteredEntries.length }} {{ t('sourceFiles') }}</span>
          <span v-if="scanResult" class="scan-time">{{ t('lastScan') }}: {{ formatTime(scanResult.scannedAt) }}</span>
        </div>

        <div v-if="loading && !scanResult" class="center-state">
          <div class="loader" />
          <p>{{ t('scanning') }}</p>
        </div>

        <div v-else-if="filteredEntries.length === 0" class="center-state">
          <div class="empty-icon">◇</div>
          <h2>{{ t('noItems') }}</h2>
          <p>{{ t('selectItem') }}</p>
        </div>

        <div v-else class="content-grid">
          <button
            v-for="entry in filteredEntries"
            :key="entry.id"
            class="content-card"
            :class="{ 'content-card--selected': entry.id === selectedEntry?.id }"
            @click="selectEntry(entry)"
          >
            <div class="content-card__media">
              <img v-if="entry.imageUrl" :src="entry.imageUrl" :alt="entry.name">
              <div v-else class="vehicle-placeholder">
                <span>{{ entry.kind === 'wheel' ? '◎' : entry.kind === 'trailer' ? '▰' : '◰' }}</span>
                <small>{{ entry.sourceType === 'pak' ? '.CLS · PAK' : '.BRO' }}</small>
              </div>
              <span v-if="entry.modified" class="edited-badge">✎ {{ t('edited') }}</span>
              <span class="kind-badge">{{ t(kindLabel(entry.kind)) }}</span>
            </div>
            <div class="content-card__body">
              <strong>{{ entry.name }}</strong>
              <span>{{ entry.category }}</span>
              <small>{{ entry.relativePath }}</small>
            </div>
          </button>
        </div>
      </section>

      <aside v-if="selectedEntry" class="inspector">
        <div class="inspector__header">
          <div>
            <span class="eyebrow">{{ t('details') }}</span>
            <h2>{{ selectedEntry.name }}</h2>
            <p>{{ selectedEntry.internalName }}</p>
          </div>
          <button class="close-button" aria-label="Close" @click="selectedId = undefined">×</button>
        </div>

        <div class="inspector__meta">
          <span>{{ selectedEntry.category }}</span>
          <span :class="{ 'meta-edited': selectedEntry.modified }">
            {{ selectedEntry.modified ? t('edited') : selectedEntry.sourceType === 'pak' ? t('basePackage') : '.bro' }}
          </span>
        </div>

        <div class="file-actions">
          <button @click="chooseImage">🖼 {{ t('chooseImage') }}</button>
          <button @click="openFile">📄 {{ t('openFile') }}</button>
        </div>

        <div class="safe-notice">
          <strong>🛡 {{ t('safeRange') }}</strong>
          <span>{{ t(selectedEntry.sourceType === 'pak' ? 'pakSafeNotice' : 'safeNotice') }}</span>
        </div>

        <div v-if="selectedEntry.parameters.length === 0" class="no-parameters">
          {{ t('noParams') }}
        </div>

        <div v-for="group in parameterGroups" :key="group.key" class="parameter-group">
          <h3>{{ t(group.key) }}</h3>
          <article v-for="parameter in group.parameters" :key="parameter.id" class="parameter-card">
            <div class="parameter-card__title">
              <strong>{{ t(parameter.labelKey) }}</strong>
              <span>{{ t('original') }}: {{ parameter.original }} {{ parameter.unit }}</span>
            </div>
            <div class="value-row">
              <label>
                <span>{{ t('current') }}</span>
                <input
                  v-model.number="draftValues[parameter.id]"
                  type="number"
                  :min="parameter.minimum"
                  :max="parameter.maximum"
                  step="any"
                >
              </label>
              <span class="unit">{{ parameter.unit }}</span>
            </div>
            <div class="recommendations">
              <button @click="applyRecommendation(parameter.id, parameter.recommended.low)">
                <small>{{ t('low') }}</small><strong>{{ parameter.recommended.low }}</strong>
              </button>
              <button @click="applyRecommendation(parameter.id, parameter.recommended.medium)">
                <small>{{ t('medium') }}</small><strong>{{ parameter.recommended.medium }}</strong>
              </button>
              <button @click="applyRecommendation(parameter.id, parameter.recommended.high)">
                <small>{{ t('high') }}</small><strong>{{ parameter.recommended.high }}</strong>
              </button>
            </div>
            <div class="range-label">
              {{ t('safeRange') }}: {{ round(parameter.minimum) }} – {{ round(parameter.maximum) }}
            </div>
          </article>
        </div>

        <div v-if="selectedEntry.parameters.length" class="inspector__footer">
          <button class="button button--secondary" :disabled="saving || !selectedEntry.modified" @click="restoreOriginal">
            {{ t('restore') }}
          </button>
          <button class="button button--primary" :disabled="saving" @click="saveChanges">
            {{ saving ? t('saving') : t('save') }}
          </button>
        </div>
      </aside>
    </main>

    <div v-if="toast" class="toast" :class="`toast--${toast.type}`">
      <strong>{{ toast.type === 'error' ? t('error') : '✓' }}</strong>
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { ContentEntry, ContentKind, EditableParameter, ScanResult } from '../shared'
import { locales, translate } from './i18n'

type View = 'all' | 'truck' | 'trailer' | 'wheel' | 'modified' | 'other'

const iconUrl = new URL('../assets/app-icon.png', import.meta.url).href
const locale = ref('es')
const view = ref<View>('all')
const search = ref('')
const loading = ref(false)
const saving = ref(false)
const scanResult = ref<ScanResult>()
const selectedId = ref<string>()
const draftValues = reactive<Record<string, number>>({})
const toast = ref<{ type: 'success' | 'error'; message: string }>()

const selectedEntry = computed(() => scanResult.value?.entries.find(entry => entry.id === selectedId.value))
const navigation = computed(() => [
  { value: 'all' as const, icon: '▦', label: t('all'), count: scanResult.value?.entries.length ?? 0 },
  { value: 'truck' as const, icon: '◰', label: t('vehicles'), count: countByKind('truck') },
  { value: 'trailer' as const, icon: '▰', label: t('trailers'), count: countByKind('trailer') },
  { value: 'wheel' as const, icon: '◎', label: t('wheels'), count: countByKind('wheel') },
  { value: 'modified' as const, icon: '✎', label: t('modified'), count: scanResult.value?.entries.filter(entry => entry.modified).length ?? 0 },
  { value: 'other' as const, icon: '◇', label: t('other'), count: countByKind('other') }
])
const currentTitle = computed(() => navigation.value.find(item => item.value === view.value)?.label ?? t('availableContent'))
const filteredEntries = computed(() => {
  const query = search.value.trim().toLowerCase()
  return (scanResult.value?.entries ?? []).filter(entry => {
    const matchesView = view.value === 'all'
      || (view.value === 'modified' ? entry.modified : entry.kind === view.value)
    const matchesSearch = !query || `${entry.name} ${entry.internalName} ${entry.relativePath}`.toLowerCase().includes(query)
    return matchesView && matchesSearch
  })
})
const parameterGroups = computed(() => {
  const groups = new Map<string, EditableParameter[]>()
  for (const parameter of selectedEntry.value?.parameters ?? []) {
    const values = groups.get(parameter.groupKey) ?? []
    values.push(parameter)
    groups.set(parameter.groupKey, values)
  }
  return [...groups.entries()].map(([key, parameters]) => ({ key, parameters }))
})

onMounted(async () => {
  try {
    const settings = await window.roadcraft.getSettings()
    locale.value = settings.locale || 'es'
    document.documentElement.lang = locale.value
    await scan()
  } catch (error) {
    showError(error)
  }
})

function t(key: string) {
  return translate(locale.value, key)
}

function countByKind(kind: ContentKind) {
  return scanResult.value?.entries.filter(entry => entry.kind === kind).length ?? 0
}

async function scan() {
  loading.value = true
  try {
    const keepSelected = selectedId.value
    scanResult.value = await window.roadcraft.scan()
    if (keepSelected && scanResult.value.entries.some(entry => entry.id === keepSelected)) {
      selectEntry(scanResult.value.entries.find(entry => entry.id === keepSelected)!)
    }
  } catch (error) {
    showError(error)
  } finally {
    loading.value = false
  }
}

async function chooseInstall() {
  try {
    const result = await window.roadcraft.chooseInstall()
    if (result) scanResult.value = result
  } catch (error) {
    showError(error)
  }
}

function selectEntry(entry: ContentEntry) {
  selectedId.value = entry.id
  for (const key of Object.keys(draftValues)) delete draftValues[key]
  for (const parameter of entry.parameters) draftValues[parameter.id] = parameter.value
}

function applyRecommendation(parameterId: string, value: number) {
  draftValues[parameterId] = value
}

async function saveChanges() {
  if (!selectedEntry.value) return
  saving.value = true
  const currentId = selectedEntry.value.id
  try {
    const result = await window.roadcraft.save({ filePath: currentId, values: { ...draftValues } })
    if (!result.ok) throw new Error(result.message)
    await scan()
    showToast('success', t('successSaved'))
  } catch (error) {
    showError(error)
  } finally {
    saving.value = false
  }
}

async function restoreOriginal() {
  if (!selectedEntry.value) return
  saving.value = true
  try {
    const result = await window.roadcraft.restore(selectedEntry.value.id)
    if (!result.ok) throw new Error(result.message)
    await scan()
    showToast('success', t('successRestored'))
  } catch (error) {
    showError(error)
  } finally {
    saving.value = false
  }
}

async function chooseImage() {
  if (!selectedEntry.value) return
  try {
    const imageUrl = await window.roadcraft.chooseImage(selectedEntry.value.id)
    if (imageUrl) selectedEntry.value.imageUrl = imageUrl
  } catch (error) {
    showError(error)
  }
}

async function openFile() {
  if (selectedEntry.value) await window.roadcraft.openFile(selectedEntry.value.id)
}

async function openSourceFolder() {
  await window.roadcraft.openSourceFolder()
}

async function launchEditor() {
  const result = await window.roadcraft.launchModEditor()
  if (!result.ok) showToast('error', result.message ?? t('error'))
}

async function changeLocale() {
  document.documentElement.lang = locale.value
  document.documentElement.dir = locale.value === 'ar' ? 'rtl' : 'ltr'
  await window.roadcraft.setLocale(locale.value)
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' }).format(timestamp)
}

function round(value: number) {
  return Number(value.toFixed(4))
}

function kindLabel(kind: ContentKind) {
  if (kind === 'truck') return 'truck'
  if (kind === 'trailer') return 'trailer'
  if (kind === 'wheel') return 'wheel'
  return 'otherKind'
}

function showError(error: unknown) {
  showToast('error', error instanceof Error ? error.message : String(error))
}

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  window.setTimeout(() => {
    toast.value = undefined
  }, 4500)
}
</script>
