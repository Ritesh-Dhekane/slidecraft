// The positioned schema: what the renderers draw. Every element has a box in inches on a 16:9 canvas
// (13.333 × 7.5, PowerPoint's default widescreen size); font sizes are in points. Both the HTML preview
// and the PPTX export read only this, so they always agree.

export const SLIDE_W = 13.333
export const SLIDE_H = 7.5

export type Box = { x: number; y: number; w: number; h: number }

export type Paragraph = {
  text: string
  bullet?: boolean
  level?: 0 | 1
  bold?: boolean
  color?: string
}

export type TextElement = Box & {
  kind: 'text'
  paragraphs: Paragraph[]
  font: string
  size: number
  color: string
  bold?: boolean
  italic?: boolean
  align: 'left' | 'center' | 'right'
  valign: 'top' | 'middle' | 'bottom'
  lineSpacing: number // multiple of the font size
  letterSpacing?: number // points
  role?: 'title' | 'kicker' | 'body' | 'caption' | 'stat' | 'quote'
}

export type ShapeElement = Box & {
  kind: 'shape'
  shape: 'rect' | 'roundRect' | 'ellipse' | 'line'
  fill?: string
  line?: { color: string; width: number } // width in points
  radius?: number // inches, for roundRect
}

export type ImageElement = Box & { kind: 'image'; url?: string; alt: string; fill: string; color: string; font: string }

export type TableElement = Box & {
  kind: 'table'
  columns: string[]
  rows: string[][]
  font: string
  size: number
  color: string
  headerFill: string
  headerColor: string
  border: string
  stripe: string
}

export type ChartElement = Box & {
  kind: 'chart'
  type: 'bar' | 'column' | 'line' | 'pie'
  labels: string[]
  series: { name: string; values: number[] }[]
  unit?: string
  colors: string[]
  font: string
  size: number
  color: string
  grid: string
}

export type Element = TextElement | ShapeElement | ImageElement | TableElement | ChartElement

export type PositionedSlide = { background: string; elements: Element[]; notes?: string }

export type PositionedDeck = { title: string; slides: PositionedSlide[]; fonts: string[] }

// Layout problems a person or agent can fix in the content, e.g. text that had to shrink a lot.
export type LayoutWarning = { slide: number; message: string }
