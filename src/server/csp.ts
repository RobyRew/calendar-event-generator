import { HEADER_CSP } from '../../scripts/security-headers.mjs'

/**
 * On server-rendered pages Astro sends its hashed script/style policy as a
 * Content-Security-Policy *header* (prerendered pages carry it in a <meta>),
 * replacing the header-only directives server.mjs sets (frame-ancestors…).
 * Append whichever of those the page policy lacks, so every page gets both.
 */
export function withHeaderDirectives(policy: string): string {
  const present = new Set(policy.split(';').map((d) => d.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean))
  const extra = HEADER_CSP.split(';')
    .map((d) => d.trim())
    .filter((d) => d && !present.has(d.split(/\s+/)[0]!.toLowerCase()))
  return [policy.trim().replace(/;$/, ''), ...extra].join('; ')
}
