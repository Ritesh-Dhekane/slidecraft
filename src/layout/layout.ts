// The layout engine: content slides (src/schema/content.ts) → positioned slides (src/schema/positioned.ts).
// Each layout places a header, its content and a footer on the 13.333 × 7.5 in canvas using the theme,
// shrinking text to fit and reporting anything that still doesn't fit.
import type { Bullet, Deck, Slide } from '../schema/content.ts'
import {
  SLIDE_H,
  SLIDE_W,
  type Box,
  type Element,
  type LayoutWarning,
  type Paragraph,
  type PositionedDeck,
  type PositionedSlide,
  type TextElement,
} from '../schema/positioned.ts'
import { fitSize, textHeight } from './text.ts'
import { THEMES, type Theme } from './themes.ts'

const M = 0.6 // side margin
const CONTENT_W = SLIDE_W - 2 * M
const BODY_TOP = 2.05 // below the header
const BODY_BOTTOM = 6.85 // above the footer
const GAP = 0.35

type Ctx = { theme: Theme; index: number; total: number; deckTitle: string; warnings: LayoutWarning[] }

function text(
  ctx: Ctx,
  box: Box,
  paragraphs: Paragraph[],
  o: Partial<TextElement> & { max: number; min?: number; what: string },
): TextElement {
  const lineSpacing = o.lineSpacing ?? 1.2
  const { size, fits } = fitSize(paragraphs, box, o.max, o.min ?? o.max, lineSpacing, o.bold)
  if (!fits)
    ctx.warnings.push({ slide: ctx.index + 1, message: `${o.what} is too long to fit — shorten it or split the slide` })
  return {
    kind: 'text',
    ...box,
    paragraphs,
    font: o.font ?? ctx.theme.fonts.body,
    size,
    color: o.color ?? ctx.theme.colors.text,
    bold: o.bold,
    italic: o.italic,
    align: o.align ?? 'left',
    valign: o.valign ?? 'top',
    lineSpacing,
    letterSpacing: o.letterSpacing,
    role: o.role,
  }
}

const para = (t: string, extra: Partial<Paragraph> = {}): Paragraph => ({ text: t, ...extra })
const bulletParas = (items: Bullet[]): Paragraph[] =>
  items.flatMap((b) =>
    typeof b === 'string'
      ? [para(b, { bullet: true })]
      : [para(b.text, { bullet: true }), ...(b.sub ?? []).map((s) => para(s, { bullet: true, level: 1 as const }))],
  )

// Title block shared by content layouts: optional kicker, the title, and a short accent rule.
function header(ctx: Ctx, title: string, kicker?: string): Element[] {
  const c = ctx.theme.colors
  const out: Element[] = [{ kind: 'shape', shape: 'rect', x: 0, y: 0, w: SLIDE_W, h: 0.09, fill: c.primary }]
  if (kicker)
    out.push(
      text(ctx, { x: M, y: 0.42, w: CONTENT_W, h: 0.3 }, [para(kicker.toUpperCase())], {
        max: 12,
        bold: true,
        color: c.accent,
        letterSpacing: 1.5,
        role: 'kicker',
        what: 'The kicker',
      }),
    )
  out.push(
    text(ctx, { x: M, y: kicker ? 0.75 : 0.55, w: CONTENT_W, h: kicker ? 1.0 : 1.2 }, [para(title)], {
      max: 32,
      min: 22,
      bold: true,
      font: ctx.theme.fonts.heading,
      lineSpacing: 1.1,
      valign: 'bottom',
      role: 'title',
      what: 'The title',
    }),
    { kind: 'shape', shape: 'rect', x: M, y: 1.82, w: 0.9, h: 0.05, fill: c.accent },
  )
  return out
}

function footer(ctx: Ctx): Element[] {
  const c = ctx.theme.colors
  const opts = { max: 10, color: c.muted, valign: 'middle' as const, role: 'caption' as const, what: 'The footer' }
  return [
    { kind: 'shape', shape: 'line', x: M, y: 6.98, w: CONTENT_W, h: 0, line: { color: c.border, width: 0.75 } },
    text(ctx, { x: M, y: 7.05, w: 9, h: 0.3 }, [para(ctx.deckTitle)], opts),
    text(ctx, { x: SLIDE_W - M - 2, y: 7.05, w: 2, h: 0.3 }, [para(`${ctx.index + 1} / ${ctx.total}`)], {
      ...opts,
      align: 'right',
    }),
  ]
}

function card(ctx: Ctx, box: Box, accent?: string): Element[] {
  const c = ctx.theme.colors
  const out: Element[] = [
    {
      kind: 'shape',
      shape: 'roundRect',
      ...box,
      fill: c.surface,
      line: { color: c.border, width: 0.75 },
      radius: 0.12,
    },
  ]
  if (accent) out.push({ kind: 'shape', shape: 'rect', x: box.x + 0.25, y: box.y, w: 0.9, h: 0.07, fill: accent })
  return out
}

// Text inside a card: heading, then body text and/or bullets, with an optional verdict pinned to the bottom.
type CardText = { heading?: string; text?: string; bullets?: string[]; verdict?: string }

// Height a card needs to show its content at full size (same spacing as cardContent).
function cardHeight(c: CardText, w: number): number {
  const body: Paragraph[] = [
    ...(c.text ? [para(c.text)] : []),
    ...(c.bullets ?? []).map((b) => para(b, { bullet: true })),
  ]
  return 0.6 + (c.heading ? 0.65 : 0) + (body.length ? textHeight(body, w - 0.6, 17, 1.25) : 0) + (c.verdict ? 0.6 : 0)
}

// Equal-height cards sized to the tallest content (at least 2.6 in), so short content doesn't leave
// half-empty cards; long content still gets the full height and shrinks to fit.
function fittedColumns(items: CardText[]): Box[] {
  const boxes = columns(items.length)
  const needed = Math.max(...items.map((c, i) => cardHeight(c, boxes[i].w)))
  const h = Math.min(boxes[0].h, Math.max(2.6, needed + 0.15))
  return boxes.map((b) => ({ ...b, h }))
}

function cardContent(ctx: Ctx, box: Box, c: CardText, label: string): Element[] {
  const pad = 0.3
  const inner = { x: box.x + pad, w: box.w - 2 * pad }
  let y = box.y + pad
  const out: Element[] = []
  if (c.heading) {
    out.push(
      text(ctx, { ...inner, y, h: 0.5 }, [para(c.heading)], {
        max: 20,
        min: 15,
        bold: true,
        font: ctx.theme.fonts.heading,
        what: `${label} heading`,
      }),
    )
    y += 0.65
  }
  const verdictH = c.verdict ? 0.6 : 0
  const body: Paragraph[] = [
    ...(c.text ? [para(c.text)] : []),
    ...(c.bullets ?? []).map((b) => para(b, { bullet: true })),
  ]
  if (body.length)
    out.push(
      text(ctx, { ...inner, y, h: box.y + box.h - pad - verdictH - y }, body, {
        max: 17,
        min: 12,
        color: ctx.theme.colors.muted,
        lineSpacing: 1.25,
        role: 'body',
        what: `${label} text`,
      }),
    )
  if (c.verdict) {
    const vy = box.y + box.h - pad - verdictH
    out.push(
      { kind: 'shape', shape: 'line', ...inner, y: vy, h: 0, line: { color: ctx.theme.colors.border, width: 0.75 } },
      text(ctx, { ...inner, y: vy + 0.1, h: 0.45 }, [para(c.verdict)], {
        max: 14,
        min: 11,
        bold: true,
        color: ctx.theme.colors.accent,
        valign: 'middle',
        what: `${label} verdict`,
      }),
    )
  }
  return out
}

function columns(n: number, top = BODY_TOP, bottom = BODY_BOTTOM): Box[] {
  const w = (CONTENT_W - GAP * (n - 1)) / n
  return Array.from({ length: n }, (_, i) => ({ x: M + i * (w + GAP), y: top, w, h: bottom - top }))
}

function layoutSlide(slide: Slide, ctx: Ctx): PositionedSlide {
  const c = ctx.theme.colors
  const body = (els: Element[]): PositionedSlide => ({
    background: c.background,
    elements: [...header(ctx, 'title' in slide ? slide.title : '', slide.kicker), ...els, ...footer(ctx)],
    notes: slide.notes,
  })

  switch (slide.layout) {
    case 'title':
    case 'closing': {
      const els: Element[] = [
        { kind: 'shape', shape: 'rect', x: 9.35, y: 0, w: SLIDE_W - 9.35, h: SLIDE_H, fill: c.primary },
        { kind: 'shape', shape: 'ellipse', x: 10.1, y: 1.7, w: 2.6, h: 2.6, fill: c.accent },
        { kind: 'shape', shape: 'rect', x: M + 0.1, y: 2.25, w: 0.9, h: 0.07, fill: c.accent },
      ]
      if (slide.kicker)
        els.push(
          text(ctx, { x: M + 0.1, y: 1.75, w: 8.2, h: 0.35 }, [para(slide.kicker.toUpperCase())], {
            max: 13,
            bold: true,
            color: c.accent,
            letterSpacing: 1.5,
            role: 'kicker',
            what: 'The kicker',
          }),
        )
      els.push(
        text(ctx, { x: M + 0.1, y: 2.5, w: 8.2, h: 2.4 }, [para(slide.title)], {
          max: 44,
          min: 28,
          bold: true,
          font: ctx.theme.fonts.heading,
          lineSpacing: 1.08,
          role: 'title',
          what: 'The title',
        }),
      )
      if (slide.subtitle)
        els.push(
          text(ctx, { x: M + 0.1, y: 5.0, w: 8.2, h: 1.2 }, [para(slide.subtitle)], {
            max: 20,
            min: 14,
            color: c.muted,
            role: 'body',
            what: 'The subtitle',
          }),
        )
      return { background: c.background, elements: els, notes: slide.notes }
    }

    case 'section':
      return {
        background: c.primary,
        elements: [
          { kind: 'shape', shape: 'rect', x: M + 0.1, y: 3.0, w: 0.9, h: 0.07, fill: c.accent },
          text(
            ctx,
            { x: M + 0.1, y: 2.1, w: 10, h: 0.6 },
            [para((slide.kicker ?? `Part ${ctx.index + 1}`).toUpperCase())],
            {
              max: 14,
              bold: true,
              color: c.accent,
              letterSpacing: 2,
              valign: 'bottom',
              role: 'kicker',
              what: 'The kicker',
            },
          ),
          text(ctx, { x: M + 0.1, y: 3.25, w: 11, h: 1.6 }, [para(slide.title)], {
            max: 40,
            min: 26,
            bold: true,
            font: ctx.theme.fonts.heading,
            color: c.onPrimary,
            lineSpacing: 1.08,
            role: 'title',
            what: 'The title',
          }),
          ...(slide.subtitle
            ? [
                text(ctx, { x: M + 0.1, y: 4.95, w: 11, h: 1.0 }, [para(slide.subtitle)], {
                  max: 18,
                  min: 13,
                  color: c.onPrimary,
                  role: 'body' as const,
                  what: 'The subtitle',
                }),
              ]
            : []),
        ],
        notes: slide.notes,
      }

    case 'bullets':
      return body([
        text(
          ctx,
          { x: M, y: BODY_TOP + 0.15, w: CONTENT_W, h: BODY_BOTTOM - BODY_TOP - 0.25 },
          bulletParas(slide.bullets),
          { max: 22, min: 14, lineSpacing: 1.3, role: 'body', what: 'The bullet list' },
        ),
      ])

    case 'two-column': {
      const [l, r] = fittedColumns([slide.left, slide.right])
      return body([
        ...card(ctx, l, c.primary),
        ...cardContent(ctx, l, slide.left, 'The left column'),
        ...card(ctx, r, c.accent),
        ...cardContent(ctx, r, slide.right, 'The right column'),
      ])
    }

    case 'comparison': {
      const boxes = fittedColumns(
        slide.items.map((i) => ({ heading: i.heading, bullets: i.points, verdict: i.verdict })),
      )
      return body(
        slide.items.flatMap((item, i) => [
          ...card(ctx, boxes[i], c.chart[i % c.chart.length]),
          ...cardContent(
            ctx,
            boxes[i],
            { heading: item.heading, bullets: item.points, verdict: item.verdict },
            `Card ${i + 1}`,
          ),
        ]),
      )
    }

    case 'table': {
      const captionH = slide.caption ? 0.5 : 0
      const rowH = Math.min(0.55, (BODY_BOTTOM - BODY_TOP - captionH - 0.1) / (slide.rows.length + 1))
      const h = rowH * (slide.rows.length + 1)
      const els: Element[] = [
        {
          kind: 'table',
          x: M,
          y: BODY_TOP + 0.1,
          w: CONTENT_W,
          h,
          columns: slide.columns,
          rows: slide.rows,
          font: ctx.theme.fonts.body,
          size: rowH < 0.45 ? 12 : 14,
          color: c.text,
          headerFill: c.primary,
          headerColor: c.onPrimary,
          border: c.border,
          stripe: c.stripe,
        },
      ]
      if (slide.caption)
        els.push(
          text(ctx, { x: M, y: BODY_TOP + 0.25 + h, w: CONTENT_W, h: 0.4 }, [para(slide.caption)], {
            max: 13,
            min: 11,
            color: c.muted,
            italic: true,
            role: 'caption',
            what: 'The caption',
          }),
        )
      return body(els)
    }

    case 'chart': {
      const side = slide.takeaways?.length ? 3.9 : 0
      const els: Element[] = [
        {
          kind: 'chart',
          x: M,
          y: BODY_TOP + 0.1,
          w: CONTENT_W - (side ? side + GAP : 0),
          h: BODY_BOTTOM - BODY_TOP - 0.1,
          ...slide.chart,
          colors: c.chart,
          font: ctx.theme.fonts.body,
          size: 12,
          color: c.muted,
          grid: c.border,
        },
      ]
      const n = slide.takeaways?.length ?? 0
      const boxH = n ? (BODY_BOTTOM - BODY_TOP - GAP * (n - 1)) / n : 0
      slide.takeaways?.forEach((t, i) => {
        const box = { x: SLIDE_W - M - side, y: BODY_TOP + i * (boxH + GAP), w: side, h: boxH }
        els.push(
          ...card(ctx, box, c.chart[i % c.chart.length]),
          ...cardContent(ctx, box, { text: t }, `Takeaway ${i + 1}`),
        )
      })
      return body(els)
    }

    case 'image-text': {
      const [l, r] = columns(2)
      const paras: Paragraph[] = [
        ...(slide.text ? [para(slide.text)] : []),
        ...(slide.bullets ?? []).map((b) => para(b, { bullet: true })),
      ]
      return body([
        {
          kind: 'image',
          ...l,
          url: slide.image.url,
          alt: slide.image.alt,
          fill: c.surface,
          color: c.muted,
          font: ctx.theme.fonts.body,
        },
        ...(paras.length
          ? [
              text(ctx, { ...r, y: r.y + 0.1, h: r.h - 0.1 }, paras, {
                max: 20,
                min: 13,
                lineSpacing: 1.3,
                role: 'body' as const,
                what: 'The text',
              }),
            ]
          : []),
      ])
    }

    case 'stats': {
      const boxes = columns(slide.stats.length, BODY_TOP + 0.6, BODY_BOTTOM - 0.6)
      return body(
        slide.stats.flatMap((s, i) => {
          const b = boxes[i]
          return [
            ...card(ctx, b, c.chart[i % c.chart.length]),
            text(ctx, { x: b.x + 0.3, y: b.y + 0.55, w: b.w - 0.6, h: 1.3 }, [para(s.value)], {
              max: 54,
              min: 30,
              bold: true,
              font: ctx.theme.fonts.heading,
              color: c.emphasis,
              role: 'stat',
              what: `Stat ${i + 1}`,
            }),
            text(ctx, { x: b.x + 0.3, y: b.y + 2.0, w: b.w - 0.6, h: b.h - 2.3 }, [para(s.label)], {
              max: 17,
              min: 12,
              color: c.muted,
              role: 'body',
              what: `Stat ${i + 1} label`,
            }),
          ]
        }),
      )
    }

    case 'quote':
      return {
        background: c.surface,
        elements: [
          { kind: 'shape', shape: 'rect', x: 0, y: 0, w: 0.18, h: SLIDE_H, fill: c.accent },
          text(ctx, { x: 1.2, y: 0.6, w: 2, h: 1.8 }, [para('“')], {
            max: 120,
            bold: true,
            font: ctx.theme.fonts.heading,
            color: c.accent,
            lineSpacing: 1,
            role: 'quote',
            what: 'The quote mark',
          }),
          text(ctx, { x: 1.4, y: 2.5, w: 10.5, h: 2.7 }, [para(slide.quote)], {
            max: 32,
            min: 20,
            italic: true,
            font: ctx.theme.fonts.heading,
            lineSpacing: 1.25,
            valign: 'middle',
            role: 'quote',
            what: 'The quote',
          }),
          ...(slide.author
            ? [
                text(
                  ctx,
                  { x: 1.4, y: 5.35, w: 10.5, h: 0.9 },
                  [
                    para(`— ${slide.author}`, { bold: true }),
                    ...(slide.role ? [para(slide.role, { color: c.muted })] : []),
                  ],
                  { max: 18, min: 13, role: 'caption' as const, what: 'The author' },
                ),
              ]
            : []),
        ],
        notes: slide.notes,
      }
  }
}

export function layoutDeck(deck: Deck): { deck: PositionedDeck; warnings: LayoutWarning[] } {
  const theme = THEMES[deck.theme]
  const warnings: LayoutWarning[] = []
  const slides = deck.slides.map((slide, index) =>
    layoutSlide(slide, { theme, index, total: deck.slides.length, deckTitle: deck.title, warnings }),
  )
  const fonts = [...new Set(Object.values(theme.fonts))]
  return { deck: { title: deck.title, slides, fonts }, warnings }
}
