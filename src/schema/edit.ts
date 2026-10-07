// Helpers for editing decks in the UI: blank slides per layout, switching a slide's layout while
// keeping what can be kept, and new decks.
import type { Deck, Layout, Slide } from './content.ts'

export const LAYOUTS: { id: Layout; name: string }[] = [
  { id: 'title', name: 'Title' },
  { id: 'section', name: 'Section' },
  { id: 'bullets', name: 'Bullets' },
  { id: 'two-column', name: 'Two columns' },
  { id: 'comparison', name: 'Comparison' },
  { id: 'table', name: 'Table' },
  { id: 'chart', name: 'Chart' },
  { id: 'image-text', name: 'Image + text' },
  { id: 'stats', name: 'Stats' },
  { id: 'quote', name: 'Quote' },
  { id: 'closing', name: 'Closing' },
]

export function blankSlide(layout: Layout, title = 'New slide'): Slide {
  switch (layout) {
    case 'title':
      return { layout, title, subtitle: 'Subtitle' }
    case 'section':
      return { layout, title }
    case 'bullets':
      return { layout, title, bullets: ['First point', 'Second point', 'Third point'] }
    case 'two-column':
      return {
        layout,
        title,
        left: { heading: 'Left', bullets: ['Point'] },
        right: { heading: 'Right', bullets: ['Point'] },
      }
    case 'comparison':
      return {
        layout,
        title,
        items: [
          { heading: 'Option A', points: ['Strength'] },
          { heading: 'Option B', points: ['Strength'] },
        ],
      }
    case 'table':
      return { layout, title, columns: ['Item', 'Value'], rows: [['Row', 'Value']] }
    case 'chart':
      return {
        layout,
        title,
        chart: { type: 'column', labels: ['A', 'B', 'C'], series: [{ name: 'Series', values: [3, 5, 4] }] },
      }
    case 'image-text':
      return { layout, title, image: { alt: 'Image' }, bullets: ['Point'] }
    case 'stats':
      return {
        layout,
        title,
        stats: [
          { value: '10', label: 'Label' },
          { value: '20', label: 'Label' },
        ],
      }
    case 'quote':
      return { layout, quote: 'A memorable quote.', author: 'Author' }
    case 'closing':
      return { layout, title: title === 'New slide' ? 'Thank you' : title }
  }
}

// Plain-text points found anywhere in a slide, to carry over when its layout changes.
function pointsOf(slide: Slide): string[] {
  switch (slide.layout) {
    case 'bullets':
      return slide.bullets.map((b) => (typeof b === 'string' ? b : b.text))
    case 'two-column':
      return [...(slide.left.bullets ?? []), ...(slide.right.bullets ?? [])]
    case 'comparison':
      return slide.items.flatMap((i) => i.points)
    case 'chart':
      return slide.takeaways ?? []
    case 'image-text':
      return slide.bullets ?? []
    case 'stats':
      return slide.stats.map((s) => `${s.value} ${s.label}`)
    default:
      return []
  }
}

export function switchLayout(slide: Slide, layout: Layout): Slide {
  if (slide.layout === layout) return slide
  const title = 'title' in slide ? slide.title : slide.quote.slice(0, 90)
  const next = blankSlide(layout, title) as Slide & { kicker?: string; notes?: string }
  if (slide.kicker && layout !== 'quote') next.kicker = slide.kicker
  if (slide.notes) next.notes = slide.notes
  const points = pointsOf(slide).slice(0, 6)
  if (points.length) {
    if (next.layout === 'bullets') next.bullets = points
    if (next.layout === 'image-text') next.bullets = points.slice(0, 5)
    if (next.layout === 'two-column') {
      const half = Math.ceil(points.length / 2)
      next.left = { ...next.left, bullets: points.slice(0, half) }
      next.right = { ...next.right, bullets: points.slice(half).length ? points.slice(half) : ['Point'] }
    }
  }
  return next
}

export function newDeck(title = 'Untitled deck'): Deck {
  return {
    title,
    theme: 'slate',
    slides: [blankSlide('title', title), blankSlide('bullets', 'Overview'), blankSlide('closing')],
  }
}

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'deck'
