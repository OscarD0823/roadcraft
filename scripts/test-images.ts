import { strict as assert } from 'node:assert'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { readPNG } from 'tex-decoder'
import { decodeRoadCraftShopTexture, ROADCRAFT_SHOP_IMAGE_HEIGHT, ROADCRAFT_SHOP_IMAGE_WIDTH } from '../src/main/shop-texture.ts'
import { readMatchingBinaryEntries } from '../src/main/zip-package.ts'

const packagesRoot = 'E:\\SteamLibrary\\steamapps\\common\\RoadCraft\\root\\paks\\client\\default'

function adjacentColorDifference(png: Buffer) {
  const decoded = readPNG(png)
  assert.equal(decoded.width, ROADCRAFT_SHOP_IMAGE_WIDTH)
  assert.equal(decoded.height, ROADCRAFT_SHOP_IMAGE_HEIGHT)

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
  const packageNames = (await readdir(packagesRoot))
    .filter(name => /^default_pct_\d+\.pak$/i.test(name))
  let validated = 0

  for (const packageName of packageNames) {
    const images = await readMatchingBinaryEntries(join(packagesRoot, packageName), entryName => (
      /package_ui_garage\/image_assets\/ui_shop_.+_0\.pct_mip$/i.test(entryName)
    ))

    for (const image of images) {
      const png = decodeRoadCraftShopTexture(image.content)
      assert(png, `No se pudo decodificar ${image.entryName}`)
      assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
      assert(adjacentColorDifference(png) < 60, `La imagen parece ruido: ${image.entryName}`)
      validated++
    }
  }

  assert(validated >= 40, `Solo se validaron ${validated} carátulas`)
  console.log(`Imágenes RoadCraft: ${validated} carátulas BC1/BC7 válidas y sin ruido multicolor.`)
}

void main()
