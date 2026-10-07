// Validates a deck and turns zod errors into short lines a person or coding agent can act on,
// e.g. `slide 7 (chart): chart.series.0.values: needs 4 values (one per label), got 3`.
import { DeckSchema, type Deck } from './content.ts'

export type ParseResult = { ok: true; deck: Deck } | { ok: false; errors: string[] }

function where(path: PropertyKey[], input: unknown): string {
  if (path[0] !== 'slides' || typeof path[1] !== 'number') return path.map(String).join('.') || 'deck'
  const slide = (input as { slides?: { layout?: string }[] } | null)?.slides?.[path[1]]
  const rest = path.slice(2).map(String).join('.')
  return `slide ${path[1] + 1}${slide?.layout ? ` (${slide.layout})` : ''}${rest ? `: ${rest}` : ''}`
}

export function parseDeck(input: unknown): ParseResult {
  const result = DeckSchema.safeParse(input)
  if (result.success) return { ok: true, deck: result.data }
  const errors = result.error.issues.map((issue) => `${where(issue.path, input)}: ${issue.message}`)
  return { ok: false, errors: [...new Set(errors)] }
}
