export const locales = [
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'it', label: '🇮🇹 Italiano' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'cs', label: '🇨🇿 Čeština' },
  { value: 'pl', label: '🇵🇱 Polski' },
  { value: 'pt-BR', label: '🇧🇷 Português' },
  { value: 'ru', label: '🇷🇺 Русский' },
  { value: 'zh-CN', label: '🇨🇳 简体中文' },
  { value: 'zh-TW', label: '🇹🇼 繁體中文' },
  { value: 'ko', label: '🇰🇷 한국어' },
  { value: 'ar', label: '🇸🇦 العربية' },
  { value: 'tr', label: '🇹🇷 Türkçe' },
  { value: 'ja', label: '🇯🇵 日本語' }
]

const en: Record<string, string> = {
  appSubtitle: 'Safe vehicle mod workspace',
  vehicles: 'Vehicles', wheels: 'Wheels', modified: 'Edited', other: 'Other', all: 'All',
  scan: 'Scan again', openFolder: 'Open source folder', openEditor: 'Open Mod Editor', changePath: 'Change game folder',
  detectedPath: 'Detected installation', availableContent: 'Editable content', modProjects: 'Mod projects',
  sourceFiles: '.bro source files', search: 'Search', searchPlaceholder: 'Vehicle, wheel or internal name...',
  noItems: 'No compatible content was found.', selectItem: 'Select an item to inspect its safe parameters.',
  parameters: 'Editable parameters', original: 'Original', current: 'Current', recommended: 'Recommended',
  low: 'Low', medium: 'Medium', high: 'High', save: 'Save changes', restore: 'Restore original',
  chooseImage: 'Choose image', openFile: 'Show file', successSaved: 'Changes saved with a backup.',
  successRestored: 'Original values restored.', error: 'Error', scanning: 'Scanning RoadCraft content...',
  safeRange: 'Protected range', language: 'Language', sourceFile: 'Source file', edited: 'Edited',
  truck: 'Vehicle', wheel: 'Wheel', otherKind: 'Resource', details: 'Details', noParams: 'No safe quick parameters are available for this file.',
  engine: 'Engine', fuel: 'Fuel', suspension: 'Suspension', gearbox: 'Gearbox', economy: 'Economy',
  wheelGeometry: 'Wheel geometry', traction: 'Traction', engineTorque: 'Engine torque', fuelCapacity: 'Fuel tank capacity',
  fuelConsumption: 'Fuel consumption', frontSuspensionStrength: 'Front suspension strength', rearSuspensionStrength: 'Rear suspension strength',
  gearSwitchDelay: 'Gear shift delay', buyCost: 'Purchase cost', wheelMass: 'Wheel mass', wheelRadius: 'Wheel radius',
  wheelWidth: 'Wheel width', sideFriction: 'Sideways friction', softForce: 'Tire deformation force',
  lastScan: 'Last scan', modificationsOnly: 'Edited only', libraryHelp: 'RoadCraft Studio edits source .bro files and leaves package building to the official Mod Editor.',
  safeNotice: 'Low, medium and high presets stay inside conservative limits. A backup is created before every save.'
}

const es: Record<string, string> = {
  ...en,
  appSubtitle: 'Centro seguro de mods para vehículos',
  vehicles: 'Vehículos', wheels: 'Llantas', modified: 'Modificados', other: 'Otros', all: 'Todos',
  scan: 'Buscar de nuevo', openFolder: 'Abrir archivos fuente', openEditor: 'Abrir Mod Editor', changePath: 'Cambiar carpeta del juego',
  detectedPath: 'Instalación detectada', availableContent: 'Contenido editable', modProjects: 'Proyectos de mods',
  sourceFiles: 'archivos fuente .bro', search: 'Buscar', searchPlaceholder: 'Vehículo, llanta o nombre interno...',
  noItems: 'No se encontró contenido compatible.', selectItem: 'Selecciona un elemento para revisar sus parámetros seguros.',
  parameters: 'Parámetros editables', original: 'Original', current: 'Actual', recommended: 'Recomendado',
  low: 'Poco', medium: 'Medio', high: 'Alto', save: 'Guardar cambios', restore: 'Restaurar original',
  chooseImage: 'Elegir imagen', openFile: 'Mostrar archivo', successSaved: 'Cambios guardados con copia de seguridad.',
  successRestored: 'Se restauraron los valores originales.', error: 'Error', scanning: 'Analizando el contenido de RoadCraft...',
  safeRange: 'Rango protegido', language: 'Idioma', sourceFile: 'Archivo fuente', edited: 'Modificado',
  truck: 'Vehículo', wheel: 'Llanta', otherKind: 'Recurso', details: 'Detalles', noParams: 'Este archivo no tiene parámetros rápidos que podamos cambiar con seguridad.',
  engine: 'Motor', fuel: 'Combustible', suspension: 'Suspensión', gearbox: 'Transmisión', economy: 'Economía',
  wheelGeometry: 'Geometría de la llanta', traction: 'Tracción', engineTorque: 'Fuerza del motor', fuelCapacity: 'Capacidad del tanque',
  fuelConsumption: 'Consumo de combustible', frontSuspensionStrength: 'Fuerza de suspensión delantera', rearSuspensionStrength: 'Fuerza de suspensión trasera',
  gearSwitchDelay: 'Demora entre cambios', buyCost: 'Precio de compra', wheelMass: 'Peso de la llanta', wheelRadius: 'Radio de la llanta',
  wheelWidth: 'Ancho de la llanta', sideFriction: 'Agarre lateral', softForce: 'Deformación del neumático',
  lastScan: 'Último análisis', modificationsOnly: 'Solo modificados',
  libraryHelp: 'RoadCraft Studio edita los archivos fuente .bro y deja la compilación del paquete al Mod Editor oficial.',
  safeNotice: 'Los niveles poco, medio y alto permanecen dentro de límites conservadores. Se crea una copia antes de cada guardado.'
}

const primaryOverrides: Record<string, Record<string, string>> = {
  fr: { appSubtitle: 'Atelier sécurisé de mods de véhicules', vehicles: 'Véhicules', wheels: 'Roues', modified: 'Modifiés', scan: 'Rechercher', openEditor: 'Ouvrir Mod Editor', search: 'Rechercher', save: 'Enregistrer', restore: 'Restaurer', language: 'Langue' },
  it: { appSubtitle: 'Area sicura per mod di veicoli', vehicles: 'Veicoli', wheels: 'Ruote', modified: 'Modificati', scan: 'Cerca di nuovo', openEditor: 'Apri Mod Editor', search: 'Cerca', save: 'Salva', restore: 'Ripristina', language: 'Lingua' },
  de: { appSubtitle: 'Sicherer Arbeitsbereich für Fahrzeug-Mods', vehicles: 'Fahrzeuge', wheels: 'Räder', modified: 'Geändert', scan: 'Neu suchen', openEditor: 'Mod Editor öffnen', search: 'Suchen', save: 'Speichern', restore: 'Original wiederherstellen', language: 'Sprache' },
  cs: { appSubtitle: 'Bezpečné pracoviště pro vozidla', vehicles: 'Vozidla', wheels: 'Kola', modified: 'Upravené', scan: 'Znovu hledat', openEditor: 'Otevřít Mod Editor', search: 'Hledat', save: 'Uložit', restore: 'Obnovit', language: 'Jazyk' },
  pl: { appSubtitle: 'Bezpieczny obszar modów pojazdów', vehicles: 'Pojazdy', wheels: 'Koła', modified: 'Edytowane', scan: 'Skanuj ponownie', openEditor: 'Otwórz Mod Editor', search: 'Szukaj', save: 'Zapisz', restore: 'Przywróć', language: 'Język' },
  'pt-BR': { appSubtitle: 'Central segura de mods de veículos', vehicles: 'Veículos', wheels: 'Rodas', modified: 'Editados', scan: 'Buscar novamente', openEditor: 'Abrir Mod Editor', search: 'Pesquisar', save: 'Salvar', restore: 'Restaurar', language: 'Idioma' },
  ru: { appSubtitle: 'Безопасная среда для модов техники', vehicles: 'Техника', wheels: 'Колёса', modified: 'Изменённые', scan: 'Обновить', openEditor: 'Открыть Mod Editor', search: 'Поиск', save: 'Сохранить', restore: 'Восстановить', language: 'Язык' },
  'zh-CN': { appSubtitle: '安全的车辆模组工作区', vehicles: '车辆', wheels: '车轮', modified: '已修改', scan: '重新扫描', openEditor: '打开模组编辑器', search: '搜索', save: '保存', restore: '恢复原始值', language: '语言' },
  'zh-TW': { appSubtitle: '安全的車輛模組工作區', vehicles: '車輛', wheels: '車輪', modified: '已修改', scan: '重新掃描', openEditor: '開啟模組編輯器', search: '搜尋', save: '儲存', restore: '還原', language: '語言' },
  ko: { appSubtitle: '안전한 차량 모드 작업 공간', vehicles: '차량', wheels: '바퀴', modified: '편집됨', scan: '다시 검색', openEditor: '모드 편집기 열기', search: '검색', save: '저장', restore: '원본 복원', language: '언어' },
  ar: { appSubtitle: 'مساحة آمنة لتعديل المركبات', vehicles: 'المركبات', wheels: 'العجلات', modified: 'المعدلة', scan: 'إعادة الفحص', openEditor: 'فتح محرر التعديلات', search: 'بحث', save: 'حفظ', restore: 'استعادة', language: 'اللغة' },
  tr: { appSubtitle: 'Güvenli araç modu çalışma alanı', vehicles: 'Araçlar', wheels: 'Tekerlekler', modified: 'Düzenlenenler', scan: 'Yeniden tara', openEditor: 'Mod Editorü aç', search: 'Ara', save: 'Kaydet', restore: 'Orijinali geri yükle', language: 'Dil' },
  ja: { appSubtitle: '安全な車両MODワークスペース', vehicles: '車両', wheels: 'ホイール', modified: '編集済み', scan: '再スキャン', openEditor: 'Mod Editorを開く', search: '検索', save: '保存', restore: '元に戻す', language: '言語' }
}

const dictionaries: Record<string, Record<string, string>> = { es, en }
for (const [locale, overrides] of Object.entries(primaryOverrides)) {
  dictionaries[locale] = { ...en, ...overrides }
}

export function translate(locale: string, key: string) {
  return dictionaries[locale]?.[key] ?? en[key] ?? key
}
