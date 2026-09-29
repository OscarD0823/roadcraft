import { strict as assert } from 'node:assert'
import { readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { readPNG } from 'tex-decoder'
import { decodeRoadCraftTexture } from '../src/main/shop-texture.ts'
import { readMatchingBinaryEntries, readMatchingTextEntries } from '../src/main/zip-package.ts'

const packagesRoot = 'E:\\SteamLibrary\\steamapps\\common\\RoadCraft\\root\\paks\\client\\default'
const resourcesPath = 'E:\\SteamLibrary\\steamapps\\common\\RoadCraft\\root\\paks\\client\\resources.pak'

function adjacentColorDifference(png: Buffer, width: number, height: number) {
  const decoded = readPNG(png)
  assert.equal(decoded.width, width)
  assert.equal(decoded.height, height)

  const pixels = decoded.color_data
  const rowSize = decoded.width * 4 + 1
  let difference = 0
  let samples = 0

  for (let y = 0; y < decoded.height; y += 3) {
    for (let x = 0; x < decoded.width - 1; x += 3) {
      const current = y * rowSize + 1 + x * 4
      const next = current + 4
      for (let channel = 0; channel < 3; channel++) {
        difference += Math.abs(pixels[current + channel] - pixels[next + channel])
        samples++
      }
    }
  }

  return difference / samples
}

async function main() {
  const descriptors = new Map<string, { width: number; height: number }>()
  const resources = await readMatchingTextEntries(resourcesPath, entryName => (
    /package_ui_(?:garage|vehicles_icons)/i.test(entryName) && /\.pct\.resource$/i.test(entryName)
  ))
  for (const resource of resources) {
    const width = Number(/^\s*sx:\s*(\d+)\s*$/mi.exec(resource.content)?.[1])
    const height = Number(/^\s*sy:\s*(\d+)\s*$/mi.exec(resource.content)?.[1])
    if (width > 0 && height > 0) descriptors.set(basename(resource.entryName, '.pct.resource').toLowerCase(), { width, height })
  }

  const packageNames = (await readdir(packagesRoot))
    .filter(name => /^default_pct_\d+\.pak$/i.test(name))
  let shopCovers = 0
  let vehicleIcons = 0

  for (const packageName of packageNames) {
    const images = await readMatchingBinaryEntries(join(packagesRoot, packageName), entryName => (
      /package_ui_garage\/image_assets\/ui_shop_.+_0\.pct_mip$/i.test(entryName)
      || /package_ui_vehicles_icons\/ui_veh_.+_0\.pct_mip$/i.test(entryName)
    ))

    for (const image of images) {
      const textureName = basename(image.entryName, '.pct_mip').replace(/_0$/i, '').toLowerCase()
      const descriptor = descriptors.get(textureName)
      assert(descriptor, `Falta el descriptor de ${image.entryName}`)
      const png = decodeRoadCraftTexture(image.content, descriptor.width, descriptor.height)
      assert(png, `No se pudo decodificar ${image.entryName}`)
      assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
      assert(adjacentColorDifference(png, descriptor.width, descriptor.height) < 60, `La imagen parece ruido: ${image.entryName}`)
      if (/ui_shop_/i.test(image.entryName)) shopCovers++
      else vehicleIcons++
    }
  }

  assert(shopCovers >= 40, `Solo se validaron ${shopCovers} carátulas`)
  assert(vehicleIcons >= 100, `Solo se validaron ${vehicleIcons} iconos de vehículos`)
  console.log(`Imágenes RoadCraft: ${shopCovers} carátulas y ${vehicleIcons} iconos oficiales BC1/BC7 válidos.`)
}

void main()
