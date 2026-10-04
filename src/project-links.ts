export const PROJECT_LINKS = Object.freeze({
  profile: 'https://github.com/OscarD0823',
  repository: 'https://github.com/OscarD0823/roadcraft'
})
export type ProjectLink = keyof typeof PROJECT_LINKS

/** The renderer selects a known destination; it cannot launch arbitrary URLs. */
export function projectLinkUrl(link: unknown): string {
  if (link !== 'profile' && link !== 'repository') throw new Error('Enlace de proyecto no válido.')
  return PROJECT_LINKS[link]
}
