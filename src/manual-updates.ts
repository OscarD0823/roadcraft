export type UpdateRepository = 'snowrunner' | 'roadcraft'

export interface UpdateInfo {
  status: 'available' | 'current' | 'empty'
  currentVersion: string
  latestVersion?: string
  releaseUrl: string
  downloadUrl?: string
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (value: string) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/.exec(value)
    if (!match) throw new Error('Invalid release version')
    const parts = match.slice(1, 4).map(Number)
    if (!parts.every(Number.isSafeInteger)) throw new Error('Invalid release version')
    return { parts, prerelease: Boolean(match[4]) }
  }
  const next = parse(candidate), installed = parse(current)
  if (next.prerelease) return false
  for (let index = 0; index < 3; index++) {
    if (next.parts[index] !== installed.parts[index]) return next.parts[index] > installed.parts[index]
  }
  return installed.prerelease
}

export function releasePage(repository: UpdateRepository): string {
  if (repository !== 'snowrunner' && repository !== 'roadcraft') throw new Error('Invalid repository')
  return `https://github.com/OscarD0823/${repository}/releases/latest`
}

export function parseRelease(repository: UpdateRepository, currentVersion: string, data: unknown): UpdateInfo {
  const empty: UpdateInfo = { status: 'empty', currentVersion, releaseUrl: releasePage(repository) }
  if (!data || typeof data !== 'object') throw new Error('Invalid GitHub response')
  const release = data as Record<string, unknown>
  if (release.draft === true || release.prerelease === true) return empty
  if (release.draft !== false || release.prerelease !== false ||
      typeof release.tag_name !== 'string' || !/^v?\d+\.\d+\.\d+$/.test(release.tag_name)) {
    throw new Error('Invalid stable release')
  }
  const tag = release.tag_name
  const latestVersion = tag.replace(/^v/, '')
  const result: UpdateInfo = {
    status: isNewerVersion(latestVersion, currentVersion) ? 'available' : 'current',
    currentVersion, latestVersion,
    releaseUrl: `https://github.com/OscarD0823/${repository}/releases/tag/${tag}`
  }
  if (result.status !== 'available') return result
  const installer = repository === 'snowrunner' ? 'SnowRunner' : 'RoadCraft'
  const names = [`${installer}.Studio.Setup.exe`, `${installer} Studio Setup.exe`]
  const prefix = `https://github.com/OscarD0823/${repository}/releases/download/${tag}/`
  const assets = Array.isArray(release.assets) ? release.assets : []
  for (const item of assets) {
    if (!item || typeof item !== 'object') continue
    const asset = item as Record<string, unknown>
    if (typeof asset.name !== 'string' || !names.includes(asset.name) ||
        asset.state !== 'uploaded' || typeof asset.size !== 'number' || asset.size <= 0) continue
    // Never accept a renderer-provided URL or an asset outside this repository/tag.
    if (asset.browser_download_url === prefix + encodeURIComponent(asset.name)) {
      result.downloadUrl = asset.browser_download_url as string
      break
    }
  }
  return result
}

export class ManualUpdates {
  private latest?: UpdateInfo
  private generation = 0
  constructor(private readonly repository: UpdateRepository, private readonly version: string,
    private readonly request: typeof fetch = fetch) {}

  async check(): Promise<UpdateInfo> {
    const generation = ++this.generation
    this.latest = undefined
    const response = await this.request(
      `https://api.github.com/repos/OscarD0823/${this.repository}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Studio-Manual-Updates',
          'X-GitHub-Api-Version': '2026-03-10' },
        signal: AbortSignal.timeout(15000), redirect: 'error'
      })
    if (response.status === 404) {
      return { status: 'empty', currentVersion: this.version, releaseUrl: releasePage(this.repository) }
    }
    if (!response.ok) throw new Error('GitHub update check failed: ' + response.status)
    const result = parseRelease(this.repository, this.version, await response.json())
    if (generation === this.generation) this.latest = result
    return result
  }

  downloadUrl(): string {
    if (this.latest?.status !== 'available' || !this.latest.downloadUrl) {
      throw new Error('Check for a published installer first')
    }
    return this.latest.downloadUrl
  }

  releaseUrl(): string { return releasePage(this.repository) }
}
