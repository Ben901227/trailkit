/**
 * Some GPS apps emit prefixed tags without declaring the prefix — OruxMaps
 * writes <om:oruxmapsextensions> with no xmlns:om. That is invalid XML, so a
 * strict parser (every browser's) rejects the whole document rather than
 * ignoring the one element it cannot name.
 *
 * Declaring the missing prefixes on the root element makes the file parseable
 * without touching any of its data.
 */

const ROOT_TAG = /<([A-Za-z_][\w.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/
// Prefixes on elements (<om:ext) and on attributes (xsi:schemaLocation=).
const USED_PREFIX = /<\/?([A-Za-z_][\w.-]*):|(?:\s)([A-Za-z_][\w.-]*):[\w.-]+\s*=/g
const DECLARED_PREFIX = /xmlns:([\w.-]+)\s*=/g

/** `xml` is predefined by the spec and must never be redeclared. */
const RESERVED = new Set(['xml', 'xmlns'])

export function findUndeclaredPrefixes(text: string): string[] {
  const declared = new Set<string>()
  for (const match of text.matchAll(DECLARED_PREFIX)) declared.add(match[1] as string)

  const missing = new Set<string>()
  for (const match of text.matchAll(USED_PREFIX)) {
    const prefix = match[1] ?? match[2]
    if (!prefix || RESERVED.has(prefix) || declared.has(prefix)) continue
    missing.add(prefix)
  }
  return [...missing]
}

/**
 * Returns the text unchanged when nothing is missing, so a well-formed file
 * costs one regex scan and no rewrite.
 */
export function declareMissingNamespaces(text: string): { text: string; declared: string[] } {
  const missing = findUndeclaredPrefixes(text)
  if (!missing.length) return { text, declared: [] }

  // Skip the XML declaration, comments and doctype to reach the root element.
  const body = text.replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>/g, (m) =>
    ' '.repeat(m.length),
  )
  const root = ROOT_TAG.exec(body)
  if (!root) return { text, declared: [] }

  const insertAt = root.index + root[0].length - (root[3] ? 2 : 1)
  const declarations = missing.map((p) => ` xmlns:${p}="urn:x-undeclared:${p}"`).join('')
  return { text: text.slice(0, insertAt) + declarations + text.slice(insertAt), declared: missing }
}
