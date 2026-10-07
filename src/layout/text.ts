// Estimating how much space text needs, without a browser: average character widths for the theme
// fonts (Segoe UI ≈ 0.5em per character, a bit more when bold) and greedy word wrapping. Errs on the
// generous side so text never spills out of its box in PowerPoint.
import type { Paragraph } from '../schema/positioned.ts'

const CHAR_EM = 0.52
const BOLD_EM = 0.57
export const BULLET_INDENT = 0.32 // inches per level
export const PARA_GAP = 0.45 // extra space between paragraphs, in lines

function linesFor(text: string, widthIn: number, sizePt: number, bold: boolean): number {
  const perLine = Math.max(1, Math.floor((widthIn * 72) / (sizePt * (bold ? BOLD_EM : CHAR_EM))))
  let lines = 1
  let used = 0
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const len = word.length
    if (used === 0) used = len
    else if (used + 1 + len <= perLine) used += 1 + len
    else {
      lines++
      used = len
    }
    while (used > perLine) {
      lines++
      used -= perLine
    }
  }
  return lines
}

// Height in inches of the paragraphs set at `sizePt` in a box `widthIn` wide.
export function textHeight(
  paragraphs: Paragraph[],
  widthIn: number,
  sizePt: number,
  lineSpacing: number,
  bold = false,
) {
  let lines = 0
  paragraphs.forEach((p, i) => {
    const indent = p.bullet ? BULLET_INDENT * ((p.level ?? 0) + 1) : 0
    lines += linesFor(p.text, widthIn - indent, sizePt, bold || !!p.bold) + (i > 0 ? PARA_GAP : 0)
  })
  return (lines * sizePt * lineSpacing) / 72
}

// Largest size between max and min (whole points) at which the text fits the box height.
export function fitSize(
  paragraphs: Paragraph[],
  box: { w: number; h: number },
  max: number,
  min: number,
  lineSpacing: number,
  bold = false,
): { size: number; fits: boolean } {
  for (let size = max; size >= min; size--) {
    if (textHeight(paragraphs, box.w, size, lineSpacing, bold) <= box.h) return { size, fits: true }
  }
  return { size: min, fits: false }
}
