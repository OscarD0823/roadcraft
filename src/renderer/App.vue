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

    <section v-if="view !== 'save'" class="workspace-hero">
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

    <section v-else class="save-hero">
      <div>
        <span class="eyebrow">ROADCRAFT COMPLETE SAVE</span>
        <h1>{{ t('saveGames') }}</h1>
        <p>{{ t('saveGamesHelp') }}</p>
      </div>
      <div class="save-hero__actions">
        <button class="button button--primary" :disabled="saveLoading" @click="refreshSaveSlots">
          <span :class="{ spin: saveLoading }">↻</span> {{ t('findSaveGames') }}
        </button>
        <button class="button button--ghost" :disabled="saveLoading" @click="chooseSaveFile">📂 {{ t('openSaveFile') }}</button>
      </div>
    </section>

    <main v-if="view !== 'save'" class="main-shell" :class="{ 'main-shell--inspector': selectedEntry }">
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
              <span v-if="entry.imageKind" class="image-badge">{{ t(`${entry.imageKind}Image`) }}</span>
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
              <span>{{ t('original') }}: {{ displayValue(parameter, parameter.original) }}</span>
            </div>
            <div v-if="parameter.kind === 'number'" class="value-row">
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
            <div v-else-if="parameter.kind === 'select'" class="value-row">
              <label>
                <span>{{ t('current') }}</span>
                <select v-model="draftValues[parameter.id]">
                  <option v-for="option in parameter.options" :key="option.value" :value="option.value">
                    {{ t(option.labelKey) }}
                  </option>
                </select>
              </label>
            </div>
            <label v-else class="boolean-row">
              <input v-model="draftValues[parameter.id]" type="checkbox">
              <span>{{ draftValues[parameter.id] ? t('enabled') : t('disabled') }}</span>
            </label>
            <div v-if="parameter.recommended" class="recommendations">
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
            <div v-if="parameter.minimum !== undefined && parameter.maximum !== undefined" class="range-label">
              {{ t('allowedRange') }}: {{ round(parameter.minimum) }} – {{ round(parameter.maximum) }}
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

    <main v-else class="save-shell">
      <aside class="save-slots">
        <div class="save-slots__header">
          <div>
            <span class="eyebrow">SLOTS</span>
            <h2>{{ t('detectedSaveGames') }}</h2>
          </div>
          <span>{{ saveSlots.length }}</span>
        </div>
        <button
          v-for="slot in saveSlots"
          :key="slot.filePath"
          class="slot-card"
          :class="{ 'slot-card--active': saveDraft?.filePath === slot.filePath }"
          @click="loadSaveFile(slot.filePath)"
        >
          <span class="slot-card__icon">▣</span>
          <span>
            <strong>{{ slot.slotName }}</strong>
            <small>{{ t('profile') }} {{ maskProfile(slot.profileId) }}</small>
            <small>{{ formatDateTime(slot.modifiedAt) }} · {{ formatFileSize(slot.size) }}</small>
          </span>
        </button>
        <div v-if="saveSlots.length === 0 && !saveLoading" class="save-empty-small">
          <strong>{{ t('noSaveGames') }}</strong>
          <span>{{ t('manualSaveHelp') }}</span>
          <button class="button button--secondary" @click="chooseSaveFile">{{ t('chooseCompleteSave') }}</button>
        </div>
      </aside>

      <section class="save-editor">
        <div v-if="saveLoading" class="center-state">
          <div class="loader" />
          <p>{{ t('loadingSaveGame') }}</p>
        </div>
        <div v-else-if="!saveDraft" class="center-state save-welcome">
          <div class="empty-icon">▣</div>
          <h2>{{ t('selectSaveGame') }}</h2>
          <p>{{ t('saveSelectionHelp') }}</p>
        </div>
        <template v-else>
          <header class="save-editor__header">
            <div>
              <span class="eyebrow">{{ maskProfile(saveDraft.profileId) }} · {{ saveDraft.slotName }}</span>
              <h2>{{ saveDraft.companyName || t('unnamedCompany') }}</h2>
              <p :title="saveDraft.filePath">{{ saveDraft.filePath }}</p>
            </div>
            <div class="save-summary">
              <span><strong>{{ saveDraft.trucks.filter(item => item.unlocked).length }}</strong>{{ t('unlockedTrucks') }}</span>
              <span><strong>{{ saveDraft.maps.filter(item => item.unlocked).length }}</strong>{{ t('unlockedMaps') }}</span>
            </div>
          </header>

          <nav class="save-tabs">
            <button :class="{ active: saveSection === 'stats' }" @click="saveSection = 'stats'">◎ {{ t('playerStats') }}</button>
            <button :class="{ active: saveSection === 'trucks' }" @click="saveSection = 'trucks'">◰ {{ t('saveTrucks') }} <small>{{ saveDraft.trucks.length }}</small></button>
            <button :class="{ active: saveSection === 'maps' }" @click="saveSection = 'maps'">⌖ {{ t('mapsResources') }} <small>{{ saveDraft.maps.length }}</small></button>
          </nav>

          <div class="save-editor__body">
            <section v-if="saveSection === 'stats'" class="save-stats-panel">
              <div class="save-notice">
                <span>🛡</span>
                <div><strong>{{ t('automaticBackup') }}</strong><p>{{ t('automaticBackupHelp') }}</p></div>
              </div>
              <div class="stat-form-grid">
                <label>
                  <span>{{ t('money') }}</span>
                  <input v-model.number="saveDraft.money" type="number" min="0" max="2000000000" step="1000">
                  <small>0 – 2,000,000,000</small>
                </label>
                <label>
                  <span>{{ t('experience') }}</span>
                  <input v-model.number="saveDraft.xp" type="number" min="0" max="2000000000" step="1000">
                  <small>0 – 2,000,000,000</small>
                </label>
                <label class="stat-form-grid__wide">
                  <span>{{ t('companyName') }}</span>
                  <input v-model="saveDraft.companyName" type="text" maxlength="64">
                  <small>{{ saveDraft.companyName.length }}/64</small>
                </label>
              </div>
            </section>

            <section v-else-if="saveSection === 'trucks'" class="save-list-panel">
              <div class="save-panel-toolbar">
                <label class="search-box"><span>⌕</span><input v-model="truckSearch" :placeholder="t('searchTruckInSave')"></label>
                <button class="button button--secondary" @click="setAllTrucks(false)">{{ t('lockAll') }}</button>
                <button class="button button--primary" @click="setAllTrucks(true)">{{ t('unlockAll') }}</button>
              </div>
              <div v-if="filteredSaveTrucks.length" class="save-truck-grid">
                <label v-for="truck in filteredSaveTrucks" :key="truck.id" class="save-truck-card" :class="{ unlocked: truck.unlocked }">
                  <input v-model="truck.unlocked" type="checkbox">
                  <span class="save-truck-card__icon">◰</span>
                  <span><strong>{{ humanizeId(truck.id) }}</strong><small>{{ truck.id }}</small></span>
                  <b>{{ truck.unlocked ? t('unlocked') : t('locked') }}</b>
                </label>
              </div>
              <div v-else class="center-state"><p>{{ t('noTrucksInSave') }}</p></div>
            </section>

            <section v-else class="save-list-panel">
              <div class="save-panel-toolbar">
                <strong>{{ t('mapsResourcesHelp') }}</strong>
                <button class="button button--secondary" @click="setAllMapsProgress(0)">{{ t('resetProgress') }}</button>
                <button class="button button--primary" @click="setAllMapsProgress(100)">{{ t('completeAll') }}</button>
              </div>
              <div class="maps-table-wrap">
                <table class="maps-table">
                  <thead><tr>
                    <th>{{ t('map') }}</th><th>{{ t('unlocked') }}</th><th>{{ t('completed') }}</th><th>{{ t('progress') }}</th>
                    <th>{{ t('fuelCoins') }}</th><th>{{ t('logs') }}</th><th>{{ t('steelBeams') }}</th><th>{{ t('concreteSlabs') }}</th><th>{{ t('steelPipes') }}</th>
                  </tr></thead>
                  <tbody>
                    <tr v-for="map in saveDraft.maps" :key="map.id">
                      <td><strong>{{ humanizeId(map.id) }}</strong><small>{{ map.id }}</small></td>
                      <td><input v-model="map.unlocked" type="checkbox"></td>
                      <td><input v-model="map.completed" type="checkbox"></td>
                      <td><input v-model.number="map.progress" type="number" min="0" max="100"></td>
                      <td><input v-model.number="map.recoveryCoins" type="number" min="0" max="9999"></td>
                      <td><input v-model.number="map.resources.logs" type="number" min="0" max="999999"></td>
                      <td><input v-model.number="map.resources.steelBeams" type="number" min="0" max="999999"></td>
                      <td><input v-model.number="map.resources.concreteSlabs" type="number" min="0" max="9999"></td>
                      <td><input v-model.number="map.resources.steelPipes" type="number" min="0" max="999999"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <footer class="save-editor__footer">
            <span>🛡 {{ t('closeGameBeforeSaving') }}</span>
            <button class="button button--primary" :disabled="saveWriting" @click="saveSaveGame">
              {{ saveWriting ? t('savingSaveGame') : t('saveGameChanges') }}
            </button>
          </footer>
        </template>
      </section>
    </main>

    <div v-if="toast" class="toast" :class="`toast--${toast.type}`">
      <strong>{{ toast.type === 'error' ? t('error') : '✓' }}</strong>
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { ContentEntry, ContentKind, EditableParameter, ParameterValue, SaveGameData, SaveSlotSummary, ScanResult } from '../shared'
import { locales, translate } from './i18n'

type View = 'all' | 'truck' | 'trailer' | 'wheel' | 'modified' | 'other' | 'save'
type SaveSection = 'stats' | 'trucks' | 'maps'

const iconUrl = new URL('../assets/app-icon.png', import.meta.url).href
const locale = ref('es')
const view = ref<View>('all')
const search = ref('')
const loading = ref(false)
const saving = ref(false)
const scanResult = ref<ScanResult>()
const selectedId = ref<string>()
const draftValues = reactive<Record<string, ParameterValue>>({})
const toast = ref<{ type: 'success' | 'error'; message: string }>()
const saveSlots = ref<SaveSlotSummary[]>([])
const saveDraft = ref<SaveGameData>()
const saveLoading = ref(false)
const saveWriting = ref(false)
const saveSection = ref<SaveSection>('stats')
const truckSearch = ref('')

const selectedEntry = computed(() => scanResult.value?.entries.find(entry => entry.id === selectedId.value))
const navigation = computed(() => [
  { value: 'all' as const, icon: '▦', label: t('all'), count: scanResult.value?.entries.length ?? 0 },
  { value: 'truck' as const, icon: '◰', label: t('vehicles'), count: countByKind('truck') },
  { value: 'trailer' as const, icon: '▰', label: t('trailers'), count: countByKind('trailer') },
  { value: 'wheel' as const, icon: '◎', label: t('wheels'), count: countByKind('wheel') },
  { value: 'modified' as const, icon: '✎', label: t('modified'), count: scanResult.value?.entries.filter(entry => entry.modified).length ?? 0 },
  { value: 'other' as const, icon: '◇', label: t('other'), count: countByKind('other') },
  { value: 'save' as const, icon: '▣', label: t('saveGames'), count: saveSlots.value.length }
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
const filteredSaveTrucks = computed(() => {
  const query = truckSearch.value.trim().toLowerCase()
  return (saveDraft.value?.trucks ?? []).filter(truck => !query || `${truck.id} ${humanizeId(truck.id)}`.toLowerCase().includes(query))
})

onMounted(async () => {
  try {
    const settings = await window.roadcraft.getSettings()
    locale.value = settings.locale || 'es'
    document.documentElement.lang = locale.value
  } catch (error) {
    showError(error)
  }
  await Promise.allSettled([scan(), refreshSaveSlots()])
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

async function refreshSaveSlots() {
  saveLoading.value = true
  try {
    const currentPath = saveDraft.value?.filePath
    saveSlots.value = await window.roadcraft.findSaveGames()
    const nextPath = currentPath && saveSlots.value.some(slot => slot.filePath === currentPath)
      ? currentPath
      : saveSlots.value[0]?.filePath
    if (nextPath) await loadSaveFile(nextPath, false)
    else saveDraft.value = undefined
  } catch (error) {
    showError(error)
  } finally {
    saveLoading.value = false
  }
}

async function chooseSaveFile() {
  saveLoading.value = true
  try {
    const data = await window.roadcraft.chooseSaveGame()
    if (!data) return
    saveDraft.value = structuredClone(data)
    if (!saveSlots.value.some(slot => slot.filePath === data.filePath)) {
      saveSlots.value.unshift({
        filePath: data.filePath,
        slotName: data.slotName,
        profileId: data.profileId,
        modifiedAt: data.modifiedAt,
        size: 0
      })
    }
  } catch (error) {
    showError(error)
  } finally {
    saveLoading.value = false
  }
}

async function loadSaveFile(filePath: string, showLoader = true) {
  if (showLoader) saveLoading.value = true
  try {
    saveDraft.value = structuredClone(await window.roadcraft.readSaveGame(filePath))
  } catch (error) {
    showError(error)
  } finally {
    if (showLoader) saveLoading.value = false
  }
}

async function saveSaveGame() {
  if (!saveDraft.value) return
  saveWriting.value = true
  try {
    const result = await window.roadcraft.writeSaveGame({
      filePath: saveDraft.value.filePath,
      money: saveDraft.value.money,
      xp: saveDraft.value.xp,
      companyName: saveDraft.value.companyName,
      trucks: saveDraft.value.trucks,
      maps: saveDraft.value.maps
    })
    if (!result.ok) throw new Error(result.message)
    await loadSaveFile(saveDraft.value.filePath, false)
    showToast('success', t('saveGameSaved'))
  } catch (error) {
    showError(error)
  } finally {
    saveWriting.value = false
  }
}

function setAllTrucks(unlocked: boolean) {
  for (const truck of saveDraft.value?.trucks ?? []) truck.unlocked = unlocked
}

function setAllMapsProgress(progress: number) {
  for (const map of saveDraft.value?.maps ?? []) {
    map.progress = progress
    if (progress === 100) {
      map.unlocked = true
      map.completed = true
    }
  }
}

async function changeLocale() {
  document.documentElement.lang = locale.value
  document.documentElement.dir = locale.value === 'ar' ? 'rtl' : 'ltr'
  await window.roadcraft.setLocale(locale.value)
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' }).format(timestamp)
}

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(timestamp)
}

function formatFileSize(size: number) {
  if (!size) return t('manualFile')
  return `${(size / 1024).toFixed(1)} KB`
}

function maskProfile(profileId: string) {
  return profileId.length > 4 ? `••••${profileId.slice(-4)}` : profileId
}

function humanizeId(value: string) {
  const cleaned = value.replace(/^rb_map_\d+_/i, '').replace(/^rb_/i, '').replaceAll('_', ' ').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : value
}

function round(value: number) {
  return Number(value.toFixed(4))
}

function displayValue(parameter: EditableParameter, value: ParameterValue) {
  if (typeof value === 'boolean') return t(value ? 'enabled' : 'disabled')
  if (parameter.kind === 'select') {
    const option = parameter.options?.find(item => item.value === value)
    return option ? t(option.labelKey) : String(value)
  }
  return `${value}${parameter.unit ? ` ${parameter.unit}` : ''}`
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
