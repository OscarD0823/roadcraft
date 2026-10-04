import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join, sep } from 'node:path'
import { encodeCompleteSave } from '../src/main/save-game'
// A synthetic native-schema fixture in ignored QA output, never a real slot.
const root=resolve('out/qa-ui/company-local')
if (!root.startsWith(resolve('out')+sep)) throw new Error('QA fixture must stay in out')
const slot=join(root,'Saber/RoadCraftGame/storage/steam/user/TEST_FIXTURE/Main/save/SLOT_99')
const document={SslValue:{money:10000,xp:25000,companyName:'Partida de prueba · NO es la del usuario',
  companyCustomization:{truckMaterialName:'customization_material_28',graffitiBackgound:'empty',graffitiLogotype:'empty',BackgoundMaterialName:'customization_material_00',LogotypeMaterialName:'customization_material_00'},
  unlockedTrucks:{test_map:['auto_aramatsu_bowhead_heavy_dumptruck_new']},lockedTrucks:[],unlockedLevels:['test_map']}}
async function main() {
  await mkdir(slot,{recursive:true})
  await writeFile(join(slot,'CompleteSave'),encodeCompleteSave({header:Buffer.alloc(53),document,trailingData:Buffer.alloc(0)},document))
  console.log('Synthetic company paint fixture prepared in out/qa-ui only.')
}
void main().catch(error=>{console.error(error);process.exitCode=1})
