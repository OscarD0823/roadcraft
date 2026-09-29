import { decodeBC1, decodeBC7, makePNG } from 'tex-decoder'

export const ROADCRAFT_SHOP_IMAGE_WIDTH = 368
export const ROADCRAFT_SHOP_IMAGE_HEIGHT = 308

/**
 * Las carátulas actuales de RoadCraft usan el formato 52 de Saber (BC7 con
 * alfa). BC3 ocupa los mismos 16 bytes por bloque, pero interpretarlo así
 * genera el ruido multicolor que se veía en las tarjetas.
 */
export function decodeRoadCraftShopTexture(content: Buffer) {
  const blockCount = Math.ceil(ROADCRAFT_SHOP_IMAGE_WIDTH / 4)
    * Math.ceil(ROADCRAFT_SHOP_IMAGE_HEIGHT / 4)
  const rgba = content.length === blockCount * 16
    ? decodeBC7(content, ROADCRAFT_SHOP_IMAGE_WIDTH, ROADCRAFT_SHOP_IMAGE_HEIGHT)
    : content.length === blockCount * 8
      ? decodeBC1(content, ROADCRAFT_SHOP_IMAGE_WIDTH, ROADCRAFT_SHOP_IMAGE_HEIGHT)
      : undefined
  if (!rgba) return

  return Buffer.from(makePNG(rgba, ROADCRAFT_SHOP_IMAGE_WIDTH, ROADCRAFT_SHOP_IMAGE_HEIGHT))
}
