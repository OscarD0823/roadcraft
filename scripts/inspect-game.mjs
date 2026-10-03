// Read-only inspection of the installed SDK and package configuration.
import { openPromise } from 'yauzl'
const packagePath = 'E:/SteamLibrary/steamapps/common/RoadCraft/root/paks/client/default/default_other.pak'
const mode = process.argv[2] ?? 'library'
const archive = await openPromise(packagePath, { lazyEntries: true })
try {
  for await (const entry of archive.eachEntry()) {
    const selected = mode === 'visual' ? entry.fileName.endsWith(`/${process.argv[3]}/${process.argv[3]}.cls`)
      : mode === 'library' ? /auto_truck_library\.sso$/.test(entry.fileName)
      : mode === 'roles' ? /(?:establish_route\/(?:ai_convoy|route_unit|traffic_unit)|trucks\/auto_(?:wayfarer|alces|tuz|aramatsu_bowhead)|(?:shop|unlock|reward).*\.sso$)/i.test(entry.fileName)
      : mode === 'names' ? /(?:ai|convoy|shop|truck_library|unlock|reward|\.mi$|\.tpl_markup$)/i.test(entry.fileName)
      : entry.fileName.includes(mode)
    if (!selected) continue
    if (mode === 'names') { console.log(entry.fileName, entry.uncompressedSize); continue }
    const chunks = []
    for await (const chunk of await archive.openReadStreamPromise(entry)) chunks.push(chunk)
    const source = Buffer.concat(chunks).toString('utf8')
    console.log('\n' + entry.fileName)
    if (mode === 'visual') {
      const lines = source.split('\n')
      lines.forEach((line, index) => { if (/^ {3}[a-z0-9_]+\s*=|nameTpl|tint|materialName|paramName|colorValue|colorParameter|isVisible|hidden|HideGeom/i.test(line)) console.log(index + 1, lines.slice(Math.max(0,index-1), index+3).join('\n')) })
    } else if (mode === 'library') {
      const blocks = [...source.matchAll(/^ {3}"?([a-z0-9_]+)"?\s*=\s*\{/gmi)]
      blocks.forEach((match, index) => {
        if (process.argv[3] && !match[1].includes(process.argv[3])) return
        const block = source.slice(match.index, blocks[index + 1]?.index ?? source.length)
        const fields = [...block.matchAll(/^ {6}([a-z0-9_]+)\s*=\s*([^\r\n{]+)/gmi)].map(m => m[1] + '=' + m[2].trim())
        console.log(match[1], fields.join(' '))
      })
    } else if (mode === 'roles') {
      console.log(source.split('\n').filter(line => /tpl|ai|convoy|route|buy|unlock|input|control|interact|type\s*=|truckType|tag\s*=|wheel|name\s*=/i.test(line)).join('\n'))
    } else {
      console.log(source.split('\n').filter(line => /^ {3}[a-z0-9_]+\s*=|^ {6}(?:nameTpl|truckName|truckType|is[A-Z][a-zA-Z]+|input|buyCost|name|uiIcon|tag)\s*=|^tag\s*=|__type\s*=\s*".*(?:AI|Convoy|Input|Access|Player|Traffic)/.test(line)).join('\n'))
    }
  }
} finally { if (archive.isOpen) archive.close() }
