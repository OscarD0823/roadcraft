// Deterministic Windows packaging only; the artwork is already generated.
const { app, nativeImage } = require('electron')
const assert = require('node:assert/strict')
const { existsSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const root = join(__dirname, '..')
const snow = existsSync(join(root, 'src/images/app-icon-master.png'))
const directory = join(root, snow ? 'src/images' : 'src/assets')
const icoPath = join(directory, snow ? 'favicon.ico' : 'app-icon.ico')
const sizes = [16, 24, 32, 48, 64, 128, 256]
const check = process.argv.includes('--check')

// Add the same safe-area margin at every icon size. No creative repainting.
function exportPng(source, size) {
  const inner = Math.max(1, Math.round(size * .90))
  const scaled = source.resize({ width: inner, height: inner, quality: 'best' }).getBitmap()
  const bitmap = Buffer.alloc(size * size * 4)
  const offset = Math.floor((size - inner) / 2)
  for (let row = 0; row < inner; row++) {
    scaled.copy(bitmap, ((row + offset) * size + offset) * 4, row * inner * 4, (row + 1) * inner * 4)
  }
  return nativeImage.createFromBitmap(bitmap, { width: size, height: size }).toPNG()
}

function encodeIco(images) {
  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16
    header[entry] = header[entry + 1] = size === 256 ? 0 : size
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map(image => image.png)])
}

function verifyPng(png, size) {
  const image = nativeImage.createFromBuffer(png)
  assert(!image.isEmpty(), 'Unreadable PNG at ' + size)
  assert.deepEqual(image.getSize(), { width: size, height: size })
  const bitmap = image.getBitmap()
  const alphas = Array.from({ length: size * size }, (_, index) => bitmap[index * 4 + 3])
  assert(alphas.some(alpha => alpha > 200), 'Empty icon')
  assert(alphas[0] === 0 && alphas[size - 1] === 0 && alphas.at(-1) === 0, 'Missing transparent safe area')
  assert(alphas.filter(alpha => alpha > 200).length > size * size * .25, 'Vehicle too small')
}

async function main() {
  await app.whenReady()
  const source = nativeImage.createFromPath(join(directory, 'app-icon-master.png'))
  assert(!source.isEmpty(), 'Missing generated master artwork')
  const dimensions = source.getSize()
  assert(dimensions.width === dimensions.height && dimensions.width >= 1024, 'Master must be square and high resolution')
  const images = sizes.map(size => ({ size, png: exportPng(source, size) }))
  images.forEach(({ png, size }) => verifyPng(png, size))
  const ico = encodeIco(images)
  const outputs = [[join(directory, 'app-icon.png'), exportPng(source, 512)], [icoPath, ico]]
  // Legacy Store files remain coherent although distribution is GitHub-only.
  if (snow) for (const [name, size] of [['icon.png', 50], ['Square44x44Logo.png', 44], ['Square150x150Logo.png', 150]]) {
    outputs.push([join(root, 'src/store-assets', name), exportPng(source, size)])
  }
  for (const [path, data] of outputs) {
    if (check) assert.deepEqual(readFileSync(path), data, 'Stale icon: ' + path)
    else writeFileSync(path, data)
  }
  if (check) {
    const file = readFileSync(icoPath)
    assert.equal(file.readUInt16LE(0), 0)
    assert.equal(file.readUInt16LE(2), 1)
    assert.equal(file.readUInt16LE(4), sizes.length)
    images.forEach(({ size }, index) => {
      const entry = 6 + index * 16
      assert.equal(file[entry] || 256, size)
      assert.equal(file[entry + 1] || 256, size)
      const length = file.readUInt32LE(entry + 8), offset = file.readUInt32LE(entry + 12)
      assert(offset + length <= file.length)
      verifyPng(file.subarray(offset, offset + length), size)
    })
    if (!snow) {
      const main = readFileSync(join(root, 'src/main/index.ts'), 'utf8')
      assert(main.includes("icon: join(currentDir, 'app-icon.ico')"), 'Window icon must use a bundled asset')
      assert(!main.includes("'src', 'assets', 'app-icon.ico'"), 'Ignored source path in packaged window')
    }
    if (snow) {
      for (const name of ['components/menu/index.vue', 'components/loading-page.vue', 'components/startup-journey.vue', 'pages/general/setup/setup.vue']) {
        const content = readFileSync(join(root, 'src/renderer', name), 'utf8')
        assert(content.includes('app-icon.png') && !content.includes('app-icon.svg'), 'Old emblem in ' + name)
      }
    }
  }
  console.log((check ? 'Verified' : 'Generated') + ': PNG + ICO (16/24/32/48/64/128/256), transparent vehicle and safe area.')
  app.exit(0)
}
main().catch(error => { console.error(error); app.exit(1) })

