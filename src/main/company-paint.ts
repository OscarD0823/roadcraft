import { objectBody } from './source-blocks'
import type { CompanyCustomization, CompanyPaint } from '../shared'

/** Read the company's descriptor only, never a truck's unique customization. */
export function readCompanyCustomization(root: Record<string, unknown>): CompanyCustomization | undefined {
  const value = root.companyCustomization
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const record = value as Record<string, unknown>
  const name = (key: string) => typeof record[key] === 'string' && /^[a-z0-9_]{1,100}$/i.test(record[key] as string) ? record[key] as string : undefined
  const truckMaterialName = name('truckMaterialName')
  if (!truckMaterialName) return
  return { truckMaterialName, graffitiBackgound: name('graffitiBackgound'), graffitiLogotype: name('graffitiLogotype'),
    BackgoundMaterialName: name('BackgoundMaterialName'), LogotypeMaterialName: name('LogotypeMaterialName') }
}

/** The MaterialDesc library is NOT the unrelated numeric damage/dirt presets. */
export function readCompanyPaintLibrary(source: string): Map<string, CompanyPaint> {
  const paints = new Map<string, CompanyPaint>(), materials = objectBody(source, 'materials')
  for (const match of materials.matchAll(/^\s*(customization_material_[a-z0-9_]+)\s*=\s*\{/gm)) {
    const id = match[1], body = objectBody(materials, id)
    if (/\bisLogo\s*=\s*True/i.test(body)) continue
    const materialName = /\bmaterialName\s*=\s*"([a-z0-9_]{1,80})"/i.exec(body)?.[1]
    if (!materialName) continue
    const defaults = objectBody(objectBody(body, 'customizationParamsWrappers'), 'default')
    const colors = [0, 1, 2].map(i => {
      const value = objectBody(objectBody(objectBody(defaults, 'layer' + i), 'tint'), 'value')
      const rgb = ['r', 'g', 'b'].map(c => Number(new RegExp(`\\b${c}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`).exec(value)?.[1] ?? NaN))
      return rgb.every(n => Number.isInteger(n) && n >= 0 && n <= 255) ? rgb : undefined
    })
    if (!colors[0]) continue
    paints.set(id, { id, materialName, colors: colors.map(rgb => rgb ?? colors[0]!), isLivery: /\bisLivery\s*=\s*True/i.test(body) })
  }
  return paints
}
