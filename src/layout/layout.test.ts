import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { THEME_IDS } from '../schema/content.ts'
import { parseDeck } from '../schema/parse.ts'
import { SLIDE_H, SLIDE_W, type Box, type Element } from '../schema/positioned.ts'
import { layoutDeck } from './layout.ts'

const sample: unknown = JSON.parse(readFileSync('decks/example-selenium-vs-cypress.json', 'utf8'))
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01
// Shapes are decoration (cards, rules); text, tables, charts and images must not collide.
const isContent = (e: Element) => e.kind !== 'shape'

describe('sample deck', () => {
  const parsed = parseDeck(sample)
  it('is valid and uses every layout', () => {
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(new Set(parsed.deck.slides.map((s) => s.layout)).size).toBe(11)
  })
  if (!parsed.ok) return

  for (const theme of THEME_IDS) {
    describe(`in the ${theme} theme`, () => {
      const { deck, warnings } = layoutDeck({ ...parsed.deck, theme })
      it('fits without warnings', () => expect(warnings).toEqual([]))
      deck.slides.forEach((slide, i) => {
        it(`slide ${i + 1}: everything is on the canvas and content does not overlap`, () => {
          for (const e of slide.elements) {
            expect(e.x).toBeGreaterThanOrEqual(0)
            expect(e.y).toBeGreaterThanOrEqual(0)
            expect(e.x + e.w).toBeLessThanOrEqual(SLIDE_W + 0.001)
            expect(e.y + e.h).toBeLessThanOrEqual(SLIDE_H + 0.001)
          }
          const content = slide.elements.filter(isContent)
          content.forEach((a, j) =>
            content.slice(j + 1).forEach((b) => expect(overlap(a, b), `${a.kind} overlaps ${b.kind}`).toBe(false)),
          )
        })
      })
    })
  }
})

describe('parseDeck errors', () => {
  it('names the slide and the problem', () => {
    const bad = {
      title: 'x',
      slides: [
        {
          layout: 'chart',
          title: 't',
          chart: { type: 'pie', labels: ['a', 'b'], series: [{ name: 's', values: [1] }] },
        },
        { layout: 'nope' },
      ],
    }
    const r = parseDeck(bad)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.join('\n')).toContain('slide 1 (chart): chart.series.0.values: needs 2 values')
      expect(r.errors.join('\n')).toMatch(/slide 2 \(nope\)/)
    }
  })

  it('warns when text is too long to fit', () => {
    const bullet = { text: 'word '.repeat(31).trim(), sub: Array(4).fill('more '.repeat(23).trim()) }
    const r = parseDeck({
      title: 'x',
      slides: [{ layout: 'bullets', title: 'Too much', bullets: Array(7).fill(bullet) }],
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(layoutDeck(r.deck).warnings[0]?.message).toContain('too long')
  })
})
