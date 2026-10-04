import assert from 'node:assert/strict'
import { PROJECT_LINKS, projectLinkUrl } from '../src/project-links'
assert.equal(projectLinkUrl('profile'),'https://github.com/OscarD0823')
assert.equal(projectLinkUrl('repository'),'https://github.com/OscarD0823/roadcraft')
for(const value of [undefined,null,0,{},'constructor','__proto__','https://example.com','file:///C:/test','javascript:alert(1)'])assert.throws(()=>projectLinkUrl(value),/no válido/)
assert(Object.isFrozen(PROJECT_LINKS))
console.log('Project links: fixed GitHub profile/repository; unknown keys and arbitrary URLs rejected.')
