import { readTplModel } from '../src/main/tpl-model'
import { readMatchingBinaryEntries, readMatchingTextEntries } from '../src/main/zip-package'
const packages = 'E:/SteamLibrary/steamapps/common/RoadCraft/root/paks/client/default/'
async function main() {
  const name = process.argv[2] ?? 'aramatsu_bowhead_30t'
  const [entry] = await readMatchingBinaryEntries(packages + 'default_tpl_' + (process.argv[3] ?? '1') + '.pak', entry => entry.endsWith('/'+name+'.tpl'), 64 * 1024 * 1024)
  if (!entry) return
  const model = readTplModel(entry.content)
  console.log('MATERIALS', JSON.stringify([...new Map(model.splits.map(split => [split.material?.mayaMtl, split.material])).values()].map(m=>({ name:m?.mayaMtl, texture:m?.shadingMtl_Tex, layer0:m?.layer0, layer1:m?.layer1 })), null, 2))
  console.log('WHEEL FRAMES', model.nodes.filter(node=>/roller_front|roller_rear|WheelFront/i.test(node.name)))
  const resources = await readMatchingTextEntries(packages + 'default_td.pak', entry => entry.toLowerCase().includes(name.toLowerCase()))
  for (const resource of resources) console.log(resource.entryName, resource.content)
}
void main()
