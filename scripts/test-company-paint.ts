import assert from 'node:assert/strict'
import * as THREE from 'three'
import { readCompanyCustomization, readCompanyPaintLibrary } from '../src/main/company-paint'
import { configureRoadPaint, configureRoadShading, materialPaint } from '../src/renderer/source-model'

assert.equal(readCompanyCustomization({ truckMaterialName:'customization_material_28' }),undefined)
assert.equal(readCompanyCustomization({ trucks:[{companyCustomization:{truckMaterialName:'customization_material_28'}}] }),undefined)
assert.equal(readCompanyCustomization({ companyCustomization:{truckMaterialName:'../unsafe'} }),undefined)
assert.equal(readCompanyCustomization({ companyCustomization:[] }),undefined)
assert.deepEqual(readCompanyCustomization({ companyCustomization:{truckMaterialName:'customization_material_28',graffitiLogotype:'empty',junk:1} }),{
  truckMaterialName:'customization_material_28',graffitiBackgound:undefined,graffitiLogotype:'empty',BackgoundMaterialName:undefined,LogotypeMaterialName:undefined
})
const layer=(i:number,rgb:number[])=>` layer${i}={tint={value={a=255;r=${rgb[0]};g=${rgb[1]};b=${rgb[2]};__type="Color"}}} `
const fixture=`materials={
customization_material_28={materialName="default_cc";isLivery=True;customizationParamsWrappers={default={${layer(0,[43,115,200])}${layer(1,[78,75,82])}${layer(2,[233,233,233])}}}}
customization_material_single={materialName="default_cc";customizationParamsWrappers={default={${layer(0,[10,20,30])}}}}
customization_material_bad={materialName="default_cc";customizationParamsWrappers={default={${layer(0,[-1,999,30])}}}}
customization_material_logo={isLogo=True;materialName="default_cc";customizationParamsWrappers={default={${layer(0,[1,2,3])}}}}
}`
const paints=readCompanyPaintLibrary(fixture.replaceAll(';',' '))
assert.equal(paints.size,2)
const paint=paints.get('customization_material_28')!
assert.deepEqual(paint.colors,[[43,115,200],[78,75,82],[233,233,233]])
assert(paint.isLivery)
const part={type:'original',transparent:false,paintable:true,tintMask:'file:///test-cc.png'}
assert.equal(materialPaint(part,paint),undefined,'Missing livery mask must retain the original part')
assert.equal(materialPaint({...part,customizationMask:'file:///livery.png'},paint),paint)
assert.equal(materialPaint({...part,paintable:false,customizationMask:'file:///livery.png'},paint),undefined)
assert.equal(materialPaint(part,{...paint,isLivery:false})?.id,paint.id)
assert.equal(materialPaint({type:'glass',transparent:true},paint),undefined)
assert.deepEqual(paints.get('customization_material_single')?.colors,[[10,20,30],[10,20,30],[10,20,30]])
assert.equal(readCompanyPaintLibrary('presets=[{tint=[255,15,47,90]}]').size,0)
const shader=()=>({uniforms:{} as Record<string,{value:unknown}>,fragmentShader:'#include <map_fragment>\n#include <metalnessmap_fragment>\n#include <aomap_fragment>',vertexShader:''})
const m=new THREE.MeshStandardMaterial(),mask=new THREE.Texture()
configureRoadShading(m,new THREE.Texture())
configureRoadPaint(m,{tint:[255,255,255],paint:{colors:paint.colors,mask}})
const compiled=shader();m.onBeforeCompile(compiled as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer)
assert.equal(compiled.uniforms.roadCompanyMask.value,mask)
for(const i of [0,1,2])assert((compiled.uniforms['roadCompanyColor'+i].value as THREE.Color).equals(new THREE.Color().setRGB(...paint.colors[i].map(c=>c/255) as [number,number,number],THREE.SRGBColorSpace)))
assert.match(compiled.fragmentShader,/roadCompanyWeights/)
assert.match(compiled.fragmentShader,/texelMetalness\.r/)
assert.match(compiled.fragmentShader,/vAoMapUv \)\.b/)
const original=new THREE.MeshStandardMaterial();configureRoadPaint(original,{tint:[89,33,41],albedoAlpha:true})
const originalShader=shader();original.onBeforeCompile(originalShader as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer)
assert(!originalShader.fragmentShader.includes('roadCompanyWeights'))
assert.notEqual(original.customProgramCacheKey(),m.customProgramCacheKey())
console.log('Company paint: native descriptor, three colour channels, invalid values, masks and PBR shader composition verified.')
