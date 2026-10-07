import { describe, expect, it } from 'vitest'
import { deckPath } from './decks.ts'

describe('deckPath', () => {
  it('accepts simple names', () => {
    expect(deckPath('selenium-vs-cypress')).toMatch(/selenium-vs-cypress\.json$/)
  })
  it('rejects names that could leave the decks folder', () => {
    for (const bad of ['../secret', 'a/b', 'Deck', '', 'x'.repeat(65)]) expect(() => deckPath(bad)).toThrow()
  })
})
