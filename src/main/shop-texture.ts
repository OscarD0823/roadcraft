import { decodeBC1, decodeBC7, makePNG } from 'tex-decoder'

export const ROADCRAFT_SHOP_IMAGE_WIDTH = 368
export const ROADCRAFT_SHOP_IMAGE_HEIGHT = 308

/**
 * Las texturas de interfaz actuales de RoadCraft usan el formato 52 de Saber
 * (BC7 con alfa). BC3 ocupa los mismos 16 bytes por bloque, pero interpretarlo
 * así genera el ruido multicolor que se veía en las tarjetas.
 */
export function decodeRoadCraftTexture(content: Buffer, width: number, height: number) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) return

  const blockCount = Math.ceil(width / 4) * Math.ceil(height / 4)
  const rgba = content.length === blockCount * 16
    ? decodeBC7(content, width, height)
    : content.length === blockCount * 8
      ? decodeBC1(content, width, height)
      : undefined
  if (!rgba) return

  return Buffer.from(makePNG(rgba, width, height))
}

export function decodeRoadCraftShopTexture(content: Buffer) {
  return decodeRoadCraftTexture(content, ROADCRAFT_SHOP_IMAGE_WIDTH, ROADCRAFT_SHOP_IMAGE_HEIGHT)
}
