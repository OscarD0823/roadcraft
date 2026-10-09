import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ManualUpdates, isNewerVersion, parseRelease, releasePage, type UpdateRepository } from '../src/manual-updates'

const repositories: UpdateRepository[] = ['snowrunner', 'roadcraft']
function fixture(repository: UpdateRepository, version = '2.7.0') {
  const name = repository === 'snowrunner' ? 'SnowRunner.Studio.Setup.exe' : 'RoadCraft.Studio.Setup.exe'
  return { tag_name: 'v' + version, draft: false, prerelease: false, assets: [{
    name, state: 'uploaded', size: 123,
    browser_download_url: `https://github.com/OscarD0823/${repository}/releases/download/v${version}/${name}`
  }] }
}

for (const [next, current, expected] of [
  ['2.10.0', '2.9.9', true], ['0.9.4', '0.9.3', true], ['2.6.2', '2.6.2', false],
  ['2.6.1', '2.6.2', false], ['3.0.0', '2.99.99', true], ['2.6.2', '2.6.2-beta.1', true],
  ['2.7.0-beta.1', '2.6.2', false]
] as const) assert.equal(isNewerVersion(next, current), expected)
for (const version of ['garbage', '1.0', '1.2.3/evil', '9999999999999999999999.1.0']) {
  assert.throws(() => isNewerVersion(version, '2.6.2'))
}

for (const repository of repositories) {
  const release = fixture(repository)
  const available = parseRelease(repository, '2.6.2', release)
  assert.equal(available.status, 'available')
  assert.equal(available.downloadUrl, release.assets[0].browser_download_url)
  assert.equal(parseRelease(repository, '2.7.0', release).status, 'current')
  assert.equal(parseRelease(repository, '3.0.0', release).downloadUrl, undefined)
  assert.equal(parseRelease(repository, '2.6.2', { ...release, draft: true }).status, 'empty')
  assert.equal(parseRelease(repository, '2.6.2', { ...release, prerelease: true }).status, 'empty')
  const noInstaller = parseRelease(repository, '2.6.2', { ...release, assets: [] })
  assert.equal(noInstaller.status, 'available'); assert.equal(noInstaller.downloadUrl, undefined)
  for (const url of ['https://example.com/setup.exe', 'http://github.com/OscarD0823/'+repository+'/setup.exe',
    release.assets[0].browser_download_url+'?redirect=evil', release.assets[0].browser_download_url.replace('/v2.7.0/', '/v2.6.0/'),
    release.assets[0].browser_download_url.replace('github.com/', 'github.com.evil/')]) {
    assert.equal(parseRelease(repository, '2.6.2', {
      ...release, assets: [{ ...release.assets[0], browser_download_url: url }]
    }).downloadUrl, undefined)
  }
  for (const change of [{ state: 'new' }, { size: 0 }, { name: 'malware.exe' }]) {
    assert.equal(parseRelease(repository, '2.6.2', {
      ...release, assets: [{ ...release.assets[0], ...change }]
    }).downloadUrl, undefined)
  }
  assert.throws(() => parseRelease(repository, '2.6.2', {}))
  assert.throws(() => parseRelease(repository, '2.6.2', { ...release, tag_name: '../../evil' }))

  let calls = 0, failure = false
  const request = async (input: unknown, options?: RequestInit) => {
    calls++
    assert.equal(input, `https://api.github.com/repos/OscarD0823/${repository}/releases/latest`)
    assert.equal(options?.redirect, 'error'); assert(options?.signal)
    assert(!JSON.stringify(options).includes('Authorization'))
    return new Response(failure ? '{}' : JSON.stringify(release), { status: failure ? 403 : 200 })
  }
  const updates = new ManualUpdates(repository, '2.6.2', request as typeof fetch)
  assert.equal(calls, 0, 'Constructing the updater must not contact GitHub')
  assert.throws(() => updates.downloadUrl(), 'Cannot download before a check')
  await updates.check()
  assert.equal(calls, 1, 'A user-requested check makes just one metadata request')
  assert.equal(updates.downloadUrl(), available.downloadUrl)
  assert.equal(calls, 1, 'Reading the chosen download URL must not download or execute it')
  assert.equal(updates.releaseUrl(), releasePage(repository))
  failure = true
  await assert.rejects(updates.check())
  assert.throws(() => updates.downloadUrl(), 'A failed check must invalidate the previous download')
  const missing = new ManualUpdates(repository, '2.6.2', (async () => new Response('', { status: 404 })) as typeof fetch)
  assert.equal((await missing.check()).status, 'empty')
  assert.throws(() => missing.downloadUrl())
  const offline = new ManualUpdates(repository, '2.6.2', (async () => { throw new Error('offline') }) as typeof fetch)
  await assert.rejects(offline.check(), /offline/)
  const broken = new ManualUpdates(repository, '2.6.2', (async () => new Response('not JSON')) as typeof fetch)
  await assert.rejects(broken.check())

  const pending: ((response: Response) => void)[] = []
  const racing = new ManualUpdates(repository, '2.6.2', (() => new Promise<Response>(resolve => pending.push(resolve))) as typeof fetch)
  const first = racing.check(), second = racing.check()
  pending[1](new Response(JSON.stringify(fixture(repository, '2.8.0'))))
  await second
  pending[0](new Response(JSON.stringify(fixture(repository, '2.7.0'))))
  await first
  assert(racing.downloadUrl().includes('/v2.8.0/'), 'A late response must not replace the most recent choice')
}

// Guard the two startup paths against accidentally restoring automatic updates.
const main = readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8')
assert(!/updateElectronApp|autoUpdater|initUpdater|initAutoUpdater/.test(main))
if (main.includes('registerDI')) {
  const updater = readFileSync(new URL('../src/modules/updates/main/index.ts', import.meta.url), 'utf8')
  assert(!/clearTemp|app\.quit|app\.relaunch|shell\.openPath|node:https/.test(updater))
}
console.log('Optional updates passed: no background requests/downloads/installation, stable versions, trusted assets, offline/retry and racing checks.')
