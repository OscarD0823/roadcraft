import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Inspect our isolated renderer; do not open tabs in the user's browser.
export async function testProjectLinks({ evaluate, call, output, repository }) {
  const results=[]
  try {
    for (const width of [600,960,1366]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:640,deviceScaleFactor:1,mobile:false})
      await evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))')
      const state=await evaluate(`(()=>{
        const links=[...document.querySelectorAll('.topbar [data-project-link]')];
        const menu=document.querySelector('.topbar .menu'),mb=menu?.getBoundingClientRect();
        return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,menu:mb?{width:mb.width,right:mb.right}:undefined,links:links.map(a=>{
          a.focus();const b=a.getBoundingClientRect(),s=getComputedStyle(a);
          return {key:a.dataset.projectLink,href:a.href,text:a.textContent.trim(),title:a.title,target:a.target,rel:a.rel,visible:b.width>0&&b.height>=24&&b.x>=0&&b.right<=innerWidth,focused:document.activeElement===a,color:s.color,outline:s.outlineWidth}
        })}
      })()`)
      assert.equal(state.overflow,false,'Header overflow at '+width)
      assert.equal(state.links.length,2)
      const profile=state.links.find(a=>a.key==='profile'),repo=state.links.find(a=>a.key==='repository')
      assert.equal(profile.href,'https://github.com/OscarD0823')
      assert.match(profile.text,/@OscarD0823/)
      assert.equal(repo.href,'https://github.com/OscarD0823/'+repository)
      for(const a of state.links){
        assert(a.visible,'Hidden creator/repository link at '+width)
        assert(a.focused&&parseFloat(a.outline)>0,'Keyboard focus not visible')
        assert(a.title);assert.equal(a.target,'_blank');assert.match(a.rel,/noopener/)
      }
      const screenshot=await call('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width,height:64,scale:1}})
      await writeFile(join(output,'project-links-'+width+'.png'),Buffer.from(screenshot.data,'base64'))
      results.push(state)
    }
  } finally {await call('Emulation.clearDeviceMetricsOverride')}
  return results
}

