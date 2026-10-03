/** Balanced reader for SDK object arrays; never executes the source. */
export function arrayObjects(source: string, field: string) {
  const match = new RegExp(`\\b${field}\\s*=\\s*\\[`).exec(source)
  if (!match) return []
  const result: string[] = []
  let braces = 0, start = 0, quoted = false, escaped = false
  for (let i = match.index + match[0].length; i < source.length; i++) {
    const char = source[i]
    if (char === '"' && !escaped) quoted = !quoted
    escaped = char === '\\' && !escaped
    if (quoted) continue
    if (char === '{') { if (!braces) start = i; braces++ }
    if (char === '}') { braces--; if (!braces) result.push(source.slice(start, i + 1)) }
    if (char === ']' && !braces) break
  }
  return result
}
