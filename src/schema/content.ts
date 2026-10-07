// The content schema: what a coding agent or the AI writes. Slides pick a layout and give only content;
// positions, sizes and styling come from the layout engine and theme (src/layout). Limits keep slides
// readable and keep AI output short.
import { z } from 'zod'

const text = (max: number) => z.string().trim().min(1).max(max)
const kicker = text(40).optional().describe('small label above the title, e.g. "Slide 4 · Architecture"')
const notes = text(2000).optional().describe('speaker notes')

export const BulletSchema = z.union([
  text(160),
  z.object({ text: text(160), sub: z.array(text(120)).max(4).optional() }).strict(),
])

const ColumnSchema = z
  .object({ heading: text(60).optional(), text: text(400).optional(), bullets: z.array(text(140)).max(6).optional() })
  .strict()
  .refine((c) => c.text || c.bullets?.length, 'a column needs text or bullets')

export const ChartSchema = z
  .object({
    type: z.enum(['bar', 'column', 'line', 'pie']),
    labels: z.array(text(30)).min(2).max(12),
    series: z
      .array(z.object({ name: text(30), values: z.array(z.number()) }).strict())
      .min(1)
      .max(4),
    unit: text(10).optional().describe('e.g. "ms" or "%"'),
  })
  .strict()
  .superRefine((c, ctx) => {
    c.series.forEach((s, i) => {
      if (s.values.length !== c.labels.length)
        ctx.addIssue({
          code: 'custom',
          path: ['series', i, 'values'],
          message: `needs ${c.labels.length} values (one per label), got ${s.values.length}`,
        })
    })
    if (c.type === 'pie' && c.series.length > 1)
      ctx.addIssue({ code: 'custom', path: ['series'], message: 'a pie chart takes one series' })
  })

const ImageSchema = z
  .object({
    url: z.string().url().optional().describe('http(s) or data: URL; leave out to show a placeholder'),
    alt: text(120),
    prompt: text(200).optional().describe('what the image should show, for finding or generating one later'),
  })
  .strict()

const base = { kicker, notes }

export const SlideSchema = z.discriminatedUnion('layout', [
  z.object({ layout: z.literal('title'), title: text(90), subtitle: text(160).optional(), ...base }).strict(),
  z.object({ layout: z.literal('section'), title: text(70), subtitle: text(140).optional(), ...base }).strict(),
  z
    .object({ layout: z.literal('bullets'), title: text(90), bullets: z.array(BulletSchema).min(1).max(7), ...base })
    .strict(),
  z
    .object({ layout: z.literal('two-column'), title: text(90), left: ColumnSchema, right: ColumnSchema, ...base })
    .strict(),
  z
    .object({
      layout: z.literal('comparison'),
      title: text(90),
      items: z
        .array(
          z
            .object({
              heading: text(40),
              points: z.array(text(110)).min(1).max(5),
              verdict: text(60).optional().describe('one-line takeaway shown at the bottom of the card'),
            })
            .strict(),
        )
        .min(2)
        .max(3),
      ...base,
    })
    .strict(),
  z
    .object({
      layout: z.literal('table'),
      title: text(90),
      columns: z.array(text(30)).min(2).max(6),
      rows: z
        .array(z.array(z.string().max(60)))
        .min(1)
        .max(8),
      caption: text(140).optional(),
      ...base,
    })
    .strict()
    .superRefine((t, ctx) => {
      t.rows.forEach((r, i) => {
        if (r.length !== t.columns.length)
          ctx.addIssue({
            code: 'custom',
            path: ['rows', i],
            message: `needs ${t.columns.length} cells (one per column), got ${r.length}`,
          })
      })
    }),
  z
    .object({
      layout: z.literal('chart'),
      title: text(90),
      chart: ChartSchema,
      takeaways: z.array(text(110)).max(3).optional(),
      ...base,
    })
    .strict(),
  z
    .object({
      layout: z.literal('image-text'),
      title: text(90),
      image: ImageSchema,
      text: text(400).optional(),
      bullets: z.array(text(140)).max(5).optional(),
      ...base,
    })
    .strict(),
  z
    .object({
      layout: z.literal('stats'),
      title: text(90),
      stats: z
        .array(z.object({ value: text(12), label: text(60) }).strict())
        .min(2)
        .max(4),
      ...base,
    })
    .strict(),
  z
    .object({
      layout: z.literal('quote'),
      quote: text(280),
      author: text(60).optional(),
      role: text(80).optional(),
      ...base,
    })
    .strict(),
  z.object({ layout: z.literal('closing'), title: text(70), subtitle: text(160).optional(), ...base }).strict(),
])

export const THEME_IDS = ['slate', 'midnight'] as const

export const DeckSchema = z
  .object({
    title: text(120),
    theme: z.enum(THEME_IDS).default('slate'),
    slides: z.array(SlideSchema).min(1).max(40),
  })
  .strict()

export type Bullet = z.infer<typeof BulletSchema>
export type Slide = z.infer<typeof SlideSchema>
export type Deck = z.infer<typeof DeckSchema>
export type Layout = Slide['layout']
export type ThemeId = (typeof THEME_IDS)[number]
