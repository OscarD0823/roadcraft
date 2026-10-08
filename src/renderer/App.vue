<template>
  <div class="app-frame" :class="{ 'app-frame--editing': selectedEntry, 'app-frame--save': view === 'save' }" :dir="locale === 'ar' ? 'rtl' : 'ltr'">
    <header class="topbar">
      <div class="brand">
        <img :src="iconUrl" alt="" class="brand__icon">
        <div class="brand__copy">
          <strong>RoadCraft Studio</strong>
          <nav class="project-links" :aria-label="t('projectLinks')">
            <a :href="PROJECT_LINKS.profile" target="_blank" rel="noopener noreferrer" data-project-link="profile" :title="t('githubAuthor')" @click.prevent="openProjectLink('profile')"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03A9.6 9.6 0 0 1 12 7c.85 0 1.71.11 2.51.34 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.57c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>@OscarD0823</a>
            <a :href="PROJECT_LINKS.repository" target="_blank" rel="noopener noreferrer" data-project-link="repository" :title="t('githubRepository')" :aria-label="t('githubRepository')" @click.prevent="openProjectLink('repository')">Repo ↗</a>
            <small class="project-version">v{{ appVersion }}</small>
          </nav>
        </div>
      </div>
      <GameBrief :t="t" :paint="companyPaint" />
      <div class="topbar__actions">
        <button class="icon-button" :class="{ 'road-mode-active': roadStatus?.status === 'enabled' }" :title="t('freeRoads')" :aria-label="t('freeRoads')" data-road-menu @click="roadPanel = true">🛣</button>
        <label class="language-select" :title="t('language')">
          <span>🌐</span>
          <select v-model="locale" @change="changeLocale">
            <option v-for="item in locales" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
        <button class="icon-button" :title="t('changePath')" :disabled="saving || loading" @click="chooseInstall">⚙</button>
      </div>
    </header>

    <section class="workspace-nav">
      <span class="sidebar-caption">{{ t('fleetWorkspace') }}</span>
      <nav class="primary-nav" :aria-label="t('mainSections')">
        <button
          v-for="item in navigation"
          :key="item.value"
          class="nav-button"
          :class="{ 'nav-button--active': view === item.value }"
          :aria-current="view === item.value ? 'page' : undefined"
          :title="item.label"
          :data-view="item.value"
          :disabled="saving"
          @click="view = item.value; selectedId = undefined"
        >
          <span class="nav-button__icon"><WorkspaceGlyph :section="item.value" /></span>
          <span>{{ item.label }}</span>
          <small>{{ item.count }}</small>
        </button>
      </nav>
      <div v-if="view !== 'save'" class="workspace-nav__tools">
        <div class="path-chip" :title="scanResult?.installPath">
          <span class="status-dot" />
          <span>{{ scanResult?.installPath || '—' }}</span>
        </div>
        <button class="tool-button" :title="t('openFolder')" @click="openSourceFolder">📁</button>
        <button class="tool-button" :title="t('openEditor')" @click="launchEditor">🛠</button>
        <button class="button button--primary" :disabled="loading" @click="scan">
          <span :class="{ spin: loading }">↻</span>
          {{ loading ? t('scanning') : t('scan') }}
        </button>
      </div>
    </section>

    <section v-if="view === 'save'" class="save-hero">
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
      <section v-show="!selectedEntry" class="library-panel">
        <div class="toolbar">
          <h2 class="section-title">{{ navigation.find(item => item.value === view)?.label }}</h2>
          <label class="search-box">
            <span>⌕</span>
            <input v-model="search" :placeholder="t('searchPlaceholder')">
          </label>
          <span class="result-label">{{ filteredEntries.length }} {{ t('sourceFiles') }}</span>
          <span v-if="scanResult" class="scan-time">{{ t('lastScan') }}: {{ formatTime(scanResult.scannedAt) }}</span>
        </div>

        <p v-if="view === 'ai'" class="library-note">{{ t('logisticsSectionHelp') }}</p>
        <p v-if="view === 'modified'" class="library-note">{{ t('modifiedDraftHelp') }}</p>
        <div v-if="missingDraftIds.length" class="library-note library-note--warning" role="status">
          {{ t('missingDraftHelp') }} ({{ missingDraftIds.length }})
          <button class="button button--secondary" @click="discardMissingDrafts">{{ t('discardMissingDrafts') }}</button>
        </div>
        <p v-if="scanResult?.logisticsScanIncomplete" class="library-note library-note--warning">{{ t('logisticsScanIncomplete') }}</p>

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
            :data-entry-id="entry.id"
            @click="selectEntry(entry)"
          >
            <div class="content-card__media">
              <img v-if="entry.imageUrl" :src="entry.imageUrl" :alt="entry.name" loading="lazy" decoding="async" @error="handleImageError(entry)">
              <div v-else class="vehicle-placeholder">
                <span>{{ entry.kind === 'trailer' ? '▰' : entry.kind === 'ai' ? '⌁' : '◰' }}</span>
                <small>{{ entry.sourceType === 'pak' ? '.CLS · PAK' : '.BRO' }}</small>
              </div>
              <span v-if="entry.modified || hasDraft(entry.id)" class="edited-badge" :class="{ 'edited-badge--pending': hasDraft(entry.id) }" :data-edit-state="hasDraft(entry.id) ? 'pending' : 'saved'">✎ {{ t(hasDraft(entry.id) ? 'unsaved' : 'edited') }}</span>
              <span class="kind-badge">{{ entry.access?.control === 'shared' ? t('sharedRouteBadge') : t(kindLabel(entry.kind)) }}</span>
            </div>
            <div class="content-card__body">
              <strong>{{ entry.name }}</strong>
              <span>{{ entry.category }}</span>
              <small>{{ entry.relativePath }}</small>
            </div>
          </button>
        </div>
      </section>

      <aside v-if="selectedEntry" class="inspector" :data-entry-id="selectedEntry.id">
        <div class="inspector__header">
          <div>
            <span class="eyebrow">{{ t('details') }}</span>
            <h2>{{ selectedEntry.name }}</h2>
            <p>{{ selectedEntry.internalName }}</p>
          </div>
          <button class="button button--secondary" :disabled="saving" @click="selectedId = undefined">← {{ t('backToLibrary') }}</button>
        </div>

        <div class="inspector__meta">
          <span>{{ selectedEntry.category }}</span>
          <span :class="{ 'meta-edited': selectedEntry.modified || hasDraft(selectedEntry.id) }" :data-edit-state="hasDraft(selectedEntry.id) ? 'pending' : selectedEntry.modified ? 'saved' : 'original'">
            {{ hasDraft(selectedEntry.id) ? t('unsaved') : selectedEntry.modified ? t('edited') : selectedEntry.sourceType === 'pak' ? t('basePackage') : '.bro' }}
          </span>
          <span v-if="selectedEntry.access">{{ t(`control_${selectedEntry.access.control}`) }}</span>
          <span v-if="selectedEntry.access?.variant === 'rusty'">{{ t('rustyVariant') }}</span>
        </div>
        <div class="editor-workspace">
          <section class="vehicle-preview" :aria-label="t('vehicleView')">
            <VehicleDrive :key="`${selectedEntry.id}:${companyPaint?.id ?? 'original'}`" :entry="selectedEntry" :company-paint="companyPaint" :t="t" />
            <div class="file-actions">
              <button @click="chooseImage">🖼 {{ t('chooseImage') }}</button>
              <button @click="openFile">📄 {{ t('openFile') }}</button>
            </div>
          </section>
          <section class="inspector-settings" :aria-label="t('vehicleSettings')">
            <nav v-if="parameterGroups.length" class="parameter-tabs" :aria-label="t('parameterSections')">
              <button v-for="group in parameterGroups" :key="group.key" :aria-pressed="activeParameterGroup === group.key" :class="{ active: activeParameterGroup === group.key }" @click="setParameterGroup(group.key)">
                {{ t(group.key) }} <small>{{ group.parameters.length }}</small>
              </button>
            </nav>
            <div class="settings-scroll" tabindex="0">
        <div v-if="hasDraft(selectedEntry.id)" class="draft-notice" :class="{ 'draft-notice--conflict': selectedDraft?.conflicts.length }" role="status" data-draft-notice>
          <strong>{{ t(selectedDraft?.conflicts.length ? 'draftConflict' : 'unsaved') }}</strong>
          <button class="button button--secondary" :disabled="saving" data-discard-draft @click="discardSelectedDraft">{{ t('discardDraft') }}</button>
          <span v-if="selectedDraft?.conflicts.length">{{ t('draftConflictHelp') }}</span>
          <details v-else><summary>{{ t('draftSessionLabel') }}</summary><p>{{ t('draftHelp') }}</p></details>
        </div>
        <div v-if="selectedEntry.access" class="access-notice">
          <strong>{{ t(selectedEntry.access.logistics?.length ? 'aiRouteInfo' : selectedEntry.access.baseVariant ? 'unconfirmedBaseInfo' : `obtain_${selectedEntry.access.obtain}`) }}</strong>
          <span v-if="selectedEntry.access.logistics?.length">{{ t(selectedEntry.access.control === 'shared' ? 'sharedRouteHelp' : 'aiRouteHelp') }}</span>
          <span v-else-if="selectedEntry.access.baseVariant">{{ t('unconfirmedBaseHelp') }}</span>
          <span v-else>{{ t('accessConfigHelp') }}<template v-if="selectedEntry.access.buyCost !== undefined"> · {{ t('configuredPrice') }}: {{ selectedEntry.access.buyCost }}</template><template v-if="selectedEntry.access.rankToUnlock !== undefined"> · {{ t('requiredRank') }}: {{ selectedEntry.access.rankToUnlock }}</template></span>
          <details v-if="selectedEntry.access.logistics?.length" class="logistics-evidence">
            <summary>{{ t('logisticsEvidence') }} ({{ selectedEntry.access.logistics.length }})</summary>
            <ul>
              <li v-for="use in selectedEntry.access.logistics" :key="`${use.map}:${use.role}`">
                <strong>{{ humanizeId(use.map) }}</strong> · {{ t(`logistics_${use.role}`) }}
                <small v-if="use.cargoNames.length">{{ t('logisticsCargo') }}: {{ use.cargoNames.map(humanizeId).join(', ') }}</small>
              </li>
            </ul>
          </details>
        </div>
        <div class="safe-notice">
          <strong>🛡 {{ t('safeRange') }}</strong>
          <span>{{ t(selectedEntry.sourceType === 'pak' ? 'pakSafeNotice' : 'safeNotice') }}</span>
        </div>

        <div v-if="linkedVariants.length" class="variant-notice">
          <label><input v-model="applyToVariants" type="checkbox" :disabled="saving" data-variant-toggle><strong>{{ t('applyToVariants') }}</strong></label>
          <p>{{ t('variantEditHelp') }}</p>
          <details><summary>{{ t('compatibleVariants') }} ({{ linkedVariants.length + 1 }})</summary>
            <ul><li v-for="entry in [selectedEntry, ...linkedVariants]" :key="entry.id">{{ entry.name }}</li></ul>
          </details>
        </div>
        <div v-if="activeParameterGroup === 'workEquipment' && selectedEntry.parameters.some(parameter => ['sandCapacity', 'sandOperatingDistance'].includes(parameter.id))" class="safe-notice">
          <strong>{{ t(roadStatus?.status === 'enabled' ? 'roadStatus_enabled' : 'protectedDumpZones') }}</strong><span>{{ t(roadStatus?.status === 'enabled' ? 'roadLimits' : 'protectedDumpZonesHelp') }}</span>
          <button class="button button--secondary" @click="roadPanel = true">🛣 {{ t('freeRoads') }}</button>
        </div>

        <div v-if="selectedEntry.parameters.length === 0" class="no-parameters">
          {{ t('noParams') }}
        </div>

        <div v-for="group in visibleParameterGroups" :key="group.key" class="parameter-group">
          <h3>{{ t(group.key) }}</h3>
          <article v-for="parameter in group.parameters" :key="parameter.id" class="parameter-card" :data-parameter-id="parameter.id">
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
                  :disabled="saving"
                >
              </label>
              <span class="unit">{{ parameter.unit }}</span>
            </div>
            <div v-else-if="parameter.kind === 'select'" class="value-row">
              <label>
                <span>{{ t('current') }}</span>
                <select v-model="draftValues[parameter.id]" :disabled="saving">
                  <option v-for="option in parameter.options" :key="option.value" :value="option.value">
                    {{ t(option.labelKey) }}
                  </option>
                </select>
              </label>
            </div>
            <label v-else class="boolean-row">
              <input v-model="draftValues[parameter.id]" type="checkbox" :disabled="saving">
              <span>{{ draftValues[parameter.id] ? t('enabled') : t('disabled') }}</span>
            </label>
            <p v-if="parameter.helpKey" class="parameter-help">{{ t(parameter.helpKey) }}</p>
            <button v-if="parameter.id === 'sandOperatingDistance'" class="button button--secondary sand-map-preset" :disabled="saving" @click="applyRecommendation(parameter.id, 10000)">{{ t('wholeMapSand') }}</button>
            <div v-if="parameter.recommended" class="recommendations">
              <button :disabled="saving" @click="applyRecommendation(parameter.id, parameter.recommended.low)">
                <small>{{ t('low') }}</small><strong>{{ parameter.recommended.low }}</strong>
              </button>
              <button :disabled="saving" @click="applyRecommendation(parameter.id, parameter.recommended.medium)">
                <small>{{ t('medium') }}</small><strong>{{ parameter.recommended.medium }}</strong>
              </button>
              <button :disabled="saving" @click="applyRecommendation(parameter.id, parameter.recommended.high)">
                <small>{{ t('high') }}</small><strong>{{ parameter.recommended.high }}</strong>
              </button>
            </div>
            <div v-if="parameter.minimum !== undefined && parameter.maximum !== undefined" class="range-label">
              {{ t('allowedRange') }}: {{ round(parameter.minimum) }} – {{ round(parameter.maximum) }}
            </div>
          </article>
        </div>

            </div>
        <div v-if="selectedEntry.parameters.length" class="inspector__footer">
          <button class="button button--secondary" :disabled="saving || !(selectedEntry.modified || applyToVariants && linkedVariants.some(entry => entry.modified))" @click="restoreOriginal">
            {{ t('restore') }}
          </button>
          <button class="button button--primary" :disabled="saving || !!selectedDraft?.conflicts.length" data-save-entry @click="saveChanges">
            {{ saving ? t('saving') : t('save') }}
          </button>
        </div>
          </section>
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
              <div class="save-notice company-paint-info" :data-paint="companyPaint?.id ?? ''">
                <span v-if="companyPaint" class="paint-swatches"><i v-for="(color,i) in companyPaint.colors" :key="i" :style="{ background: `rgb(${color.join(',')})` }" /></span>
                <div><strong>{{ t('companyPaintTitle') }}</strong><p>{{ t(companyPaint ? 'companyPaintHelp' : 'companyPaintMissing') }}</p></div>
              </div>
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

    <RoadZonesPanel v-model:open="roadPanel" :t="t" :checked-at="scanResult?.scannedAt" @status="roadStatus = $event" @error="showError" />
    <div v-if="toast" class="toast" :class="`toast--${toast.type}`">
      <strong>{{ toast.type === 'error' ? t('error') : '✓' }}</strong>
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { CompanyPaint, ContentEntry, ContentKind, EditableParameter, ParameterValue, SaveGameData, SaveSlotSummary, ScanResult, RoadZoneStatus } from '../shared'
import { entryInSection, vehicleFamilyKey } from '../shared'
import { locales, translate } from './i18n'
import VehicleDrive from './components/vehicle-drive.vue'
import RoadZonesPanel from './components/road-zones-panel.vue'
import GameBrief from './components/game-brief.vue'
import WorkspaceGlyph from './components/workspace-glyph.vue'
import { PROJECT_LINKS, type ProjectLink } from '../project-links'
import { createEntryDraft, hasPendingChanges, rebaseEntryDraft, type EntryDraft } from './entry-drafts'

type View = 'all' | 'truck' | 'trailer' | 'ai' | 'modified' | 'other' | 'save'
type SaveSection = 'stats' | 'trucks' | 'maps'

const iconUrl = new URL('../assets/app-icon.png', import.meta.url).href
const locale = ref('es')
const appVersion = ref('—')
const roadPanel = ref(false)
const roadStatus = ref<RoadZoneStatus>()
const view = ref<View>('all')
const search = ref('')
const loading = ref(false)
const saving = ref(false)
const scanResult = ref<ScanResult>()
const selectedId = ref<string>()
const entryDrafts = reactive<Record<string, EntryDraft>>({})
const selectedDraft = computed(() => selectedId.value ? entryDrafts[selectedId.value] : undefined)
const draftValues = computed(() => selectedDraft.value?.values ?? {})
const applyToVariants = computed({
  get: () => selectedDraft.value?.applyToVariants ?? true,
  set: value => { if (selectedDraft.value) selectedDraft.value.applyToVariants = value }
})
const activeParameterGroup = ref('engine')
const toast = ref<{ type: 'success' | 'error'; message: string }>()
const saveSlots = ref<SaveSlotSummary[]>([])
const saveDraft = ref<SaveGameData>()
const companyPaint = ref<CompanyPaint>()
let paintRequest = 0
watch(() => saveDraft.value?.companyCustomization?.truckMaterialName, async material => {
  const request = ++paintRequest
  companyPaint.value = undefined
  if (!material) return
  try {
    const paint = await window.roadcraft.getCompanyPaint(material)
    if (request === paintRequest) companyPaint.value = paint
  } catch { /* Missing game/library must not prevent reading a valid save. */ }
})
const saveLoading = ref(false)
const saveWriting = ref(false)
const saveSection = ref<SaveSection>('stats')
const truckSearch = ref('')

const selectedEntry = computed(() => scanResult.value?.entries.find(entry => entry.id === selectedId.value))
const missingDraftIds = computed(() => Object.keys(entryDrafts).filter(id => hasDraft(id)
  && !scanResult.value?.entries.some(entry => entry.id === id)))
const linkedVariants = computed(() => {
  const selected = selectedEntry.value
  const family = selected && vehicleFamilyKey(selected)
  return !family ? [] : (scanResult.value?.entries ?? []).filter(entry => entry.id !== selected!.id
    && entry.filePath === selected!.filePath && vehicleFamilyKey(entry) === family)
})
const navigation = computed(() => [
  { value: 'all' as const, icon: '▦', label: t('all'), count: scanResult.value?.entries.length ?? 0 },
  { value: 'truck' as const, icon: '◰', label: t('vehicles'), count: countByKind('truck') },
  { value: 'trailer' as const, icon: '▰', label: t('trailers'), count: countByKind('trailer') },
  { value: 'ai' as const, icon: '⌁', label: t('aiVehicles'), count: countByKind('ai') },
  { value: 'modified' as const, icon: '✎', label: t('modified'), count: scanResult.value?.entries.filter(entry => entry.modified || hasDraft(entry.id)).length ?? 0 },
  { value: 'other' as const, icon: '◇', label: t('other'), count: countByKind('other') },
  { value: 'save' as const, icon: '▣', label: t('saveGames'), count: saveSlots.value.length }
])
const filteredEntries = computed(() => {
  const query = search.value.trim().toLowerCase()
  return (scanResult.value?.entries ?? []).filter(entry => {
    const matchesView = view.value === 'all'
      || (view.value === 'modified' ? entry.modified || hasDraft(entry.id) : view.value !== 'save' && entryInSection(entry, view.value))
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
const visibleParameterGroups = computed(() => parameterGroups.value.filter(group => group.key === activeParameterGroup.value))
const filteredSaveTrucks = computed(() => {
  const query = truckSearch.value.trim().toLowerCase()
  return (saveDraft.value?.trucks ?? []).filter(truck => !query || `${truck.id} ${humanizeId(truck.id)}`.toLowerCase().includes(query))
})

onMounted(async () => {
  try {
    const settings = await window.roadcraft.getSettings()
    locale.value = settings.locale || 'es'
    appVersion.value = settings.version || '—'
    document.documentElement.lang = locale.value
  } catch (error) {
    showError(error)
  }
  await Promise.allSettled([scan(), refreshSaveSlots()])
})

function t(key: string) {
  return translate(locale.value, key)
}

async function openProjectLink(link: ProjectLink) {
  try { await window.roadcraft.openProjectLink(link) } catch (error) { showError(error) }
}

function countByKind(kind: ContentKind) {
  return scanResult.value?.entries.filter(entry => entryInSection(entry, kind)).length ?? 0
}

function hasDraft(id: string) { return hasPendingChanges(entryDrafts[id]) }

function discardSelectedDraft() {
  if (!saving.value && selectedEntry.value) entryDrafts[selectedEntry.value.id] = createEntryDraft(selectedEntry.value)
}

function discardMissingDrafts() {
  for (const id of missingDraftIds.value) delete entryDrafts[id]
}

function acceptScan(result: ScanResult) {
  for (const entry of result.entries) {
    const draft = entryDrafts[entry.id]
    if (draft) rebaseEntryDraft(draft, entry)
  }
  scanResult.value = result
  const selected = result.entries.find(entry => entry.id === selectedId.value)
  if (selected) selectEntry(selected)
  else selectedId.value = undefined
}

async function scan() {
  loading.value = true
  try {
    acceptScan(await window.roadcraft.scan())
  } catch (error) {
    showError(error)
  } finally {
    loading.value = false
  }
}

async function chooseInstall() {
  if (saving.value || loading.value) return
  if (Object.values(entryDrafts).some(hasPendingChanges)) {
    showToast('error', t('pendingBeforePath'))
    return
  }
  try {
    const result = await window.roadcraft.chooseInstall()
    if (result) { for (const id of Object.keys(entryDrafts)) delete entryDrafts[id]; acceptScan(result) }
  } catch (error) {
    showError(error)
  }
}

function selectEntry(entry: ContentEntry) {
  if (saving.value && selectedId.value !== entry.id) return
  entryDrafts[entry.id] ??= createEntryDraft(entry)
  selectedId.value = entry.id
  if (!entry.parameters.some(parameter => parameter.groupKey === activeParameterGroup.value)) {
    activeParameterGroup.value = entry.parameters[0]?.groupKey ?? 'engine'
  }
}

function setParameterGroup(group: string) {
  activeParameterGroup.value = group
  // Drafts belong to the entry, not the visible category; switching never resets them.
  document.querySelector('.settings-scroll')?.scrollTo({ top: 0 })
}

function handleImageError(entry: ContentEntry) {
  entry.imageUrl = undefined
  entry.imageKind = undefined
}

function applyRecommendation(parameterId: string, value: number) {
  if (!saving.value) draftValues.value[parameterId] = value
}

async function saveChanges() {
  if (!selectedEntry.value || saving.value || selectedDraft.value?.conflicts.length) return
  saving.value = true
  const currentId = selectedEntry.value.id
  try {
    const result = await window.roadcraft.save({ filePath: currentId, values: { ...draftValues.value }, applyToVariants: applyToVariants.value })
    if (!result.ok) throw new Error(result.message)
    const refreshed = await window.roadcraft.scan()
    // Only the submitted draft is cleared. Other variants retain their own pending work.
    delete entryDrafts[currentId]
    acceptScan(refreshed)
    showToast('success', `${t('successSaved')} ${result.affectedIds?.length ?? 1} ${t('variantsUpdated')}`)
  } catch (error) {
    showError(error)
  } finally {
    saving.value = false
  }
}

async function restoreOriginal() {
  if (!selectedEntry.value || saving.value) return
  saving.value = true
  const currentId = selectedEntry.value.id
  try {
    const result = await window.roadcraft.restore(currentId, applyToVariants.value)
    if (!result.ok) throw new Error(result.message)
    const refreshed = await window.roadcraft.scan()
    delete entryDrafts[currentId]
    acceptScan(refreshed)
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
  if (kind === 'ai') return 'aiVehicle'
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
