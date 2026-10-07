// Positioned deck → .pptx with pptxgenjs. Every element becomes a native PowerPoint object — text boxes,
// shapes, tables, charts, images — so the file stays fully editable. Works in the browser and in Node.
import PptxGenJS from 'pptxgenjs'
import { BULLET_INDENT, PARA_GAP } from '../../layout/text.ts'
import { SLIDE_H, SLIDE_W, type Element, type PositionedDeck } from '../../schema/positioned.ts'

const hex = (c: string) => c.replace('#', '').toUpperCase()

const SHAPES = { rect: 'rect', roundRect: 'roundRect', ellipse: 'ellipse', line: 'line' } as const

const CHARTS = { bar: 'bar', column: 'bar', line: 'line', pie: 'pie' } as const

function addElement(slide: PptxGenJS.Slide, el: Element) {
  const pos = { x: el.x, y: el.y, w: el.w, h: el.h }
  switch (el.kind) {
    case 'text':
      slide.addText(
        el.paragraphs.map((p, i) => ({
          text: p.text,
          options: {
            bullet: p.bullet ? { indent: BULLET_INDENT * 72, characterCode: p.level ? '2013' : '2022' } : false,
            indentLevel: p.bullet ? (p.level ?? 0) : 0,
            bold: p.bold ?? el.bold,
            color: p.color ? hex(p.color) : undefined,
            breakLine: true,
            paraSpaceBefore: i ? el.size * el.lineSpacing * PARA_GAP : 0,
          },
        })),
        {
          ...pos,
          fontFace: el.font,
          fontSize: el.size,
          color: hex(el.color),
          bold: el.bold,
          italic: el.italic,
          align: el.align,
          valign: el.valign,
          // Exact spacing in points: a "multiple" in PowerPoint is relative to the font's own line height, not its size.
          lineSpacing: el.size * el.lineSpacing,
          charSpacing: el.letterSpacing,
          margin: 0,
          fit: 'none',
          objectName: el.role,
        },
      )
      return
    case 'shape':
      slide.addShape(SHAPES[el.shape], {
        ...pos,
        fill: el.fill ? { color: hex(el.fill) } : { type: 'none' },
        line: el.line ? { color: hex(el.line.color), width: el.line.width } : { type: 'none' },
        // pptxgenjs takes the corner radius as a fraction (0–1) of half the shorter side.
        rectRadius: el.shape === 'roundRect' ? Math.min(1, (el.radius ?? 0.1) / (Math.min(el.w, el.h) / 2)) : undefined,
      })
      return
    case 'image':
      if (el.url) {
        slide.addImage({
          ...pos,
          path: el.url.startsWith('data:') ? undefined : el.url,
          data: el.url.startsWith('data:') ? el.url : undefined,
          altText: el.alt,
          sizing: { type: 'cover', w: el.w, h: el.h },
        })
      } else {
        // No image yet: an editable placeholder the user can replace in PowerPoint.
        slide.addText(el.alt, {
          ...pos,
          shape: 'roundRect',
          rectRadius: Math.min(1, 0.12 / (Math.min(el.w, el.h) / 2)),
          fill: { color: hex(el.fill) },
          color: hex(el.color),
          fontFace: el.font,
          fontSize: 14,
          align: 'center',
          valign: 'middle',
          objectName: 'image placeholder',
        })
      }
      return
    case 'table': {
      const border = { type: 'solid' as const, pt: 0.75, color: hex(el.border) }
      const header = el.columns.map((c) => ({
        text: c,
        options: { bold: true, color: hex(el.headerColor), fill: { color: hex(el.headerFill) } },
      }))
      const rows = el.rows.map((r, i) =>
        r.map((cell) => ({ text: cell, options: i % 2 ? { fill: { color: hex(el.stripe) } } : {} })),
      )
      slide.addTable([header, ...rows], {
        ...pos,
        colW: Array(el.columns.length).fill(el.w / el.columns.length),
        rowH: el.h / (el.rows.length + 1),
        fontFace: el.font,
        fontSize: el.size,
        color: hex(el.color),
        border,
        valign: 'middle',
        margin: [0, 0.1, 0, 0.1], // inches in pptxgenjs 4
      })
      return
    }
    case 'chart': {
      const data = el.series.map((s) => ({ name: s.name, labels: el.labels, values: s.values }))
      const axis = { color: hex(el.color), fontFace: el.font, fontSize: el.size }
      slide.addChart(CHARTS[el.type], el.type === 'pie' ? data.slice(0, 1) : data, {
        ...pos,
        chartColors: el.colors.map(hex),
        barDir: el.type === 'bar' ? 'bar' : 'col',
        barGrouping: 'clustered',
        barGapWidthPct: 60,
        lineSize: 3,
        lineDataSymbol: 'circle',
        showLegend: el.series.length > 1 || el.type === 'pie',
        legendPos: 't',
        legendFontFace: el.font,
        legendFontSize: el.size,
        legendColor: hex(el.color),
        catAxisLabelColor: axis.color,
        catAxisLabelFontFace: axis.fontFace,
        catAxisLabelFontSize: axis.fontSize,
        valAxisLabelColor: axis.color,
        valAxisLabelFontFace: axis.fontFace,
        valAxisLabelFontSize: axis.fontSize,
        valAxisLabelFormatCode: el.unit ? `0"${el.unit}"` : '0',
        valGridLine: { color: hex(el.grid), size: 0.75 },
        catGridLine: { style: 'none' },
        showPercent: el.type === 'pie',
        dataLabelColor: 'FFFFFF',
      })
      return
    }
  }
}

export function buildPptx(deck: PositionedDeck): PptxGenJS {
  const pres = new PptxGenJS()
  pres.defineLayout({ name: 'SLIDECRAFT_16x9', width: SLIDE_W, height: SLIDE_H })
  pres.layout = 'SLIDECRAFT_16x9'
  pres.title = deck.title
  pres.company = 'slidecraft'
  for (const s of deck.slides) {
    const slide = pres.addSlide()
    slide.background = { color: hex(s.background) }
    for (const el of s.elements) addElement(slide, el)
    if (s.notes) slide.addNotes(s.notes)
  }
  return pres
}

// Node: the file as bytes. Browser: use buildPptx(deck).writeFile({ fileName }).
export async function pptxBytes(deck: PositionedDeck): Promise<Uint8Array> {
  const out = await buildPptx(deck).write({ outputType: 'uint8array' })
  return out as Uint8Array
}
