// Draws one positioned slide in HTML/SVG, scaled to the width of its container. The layout engine has
// already decided every position and size, so this only translates inches/points to pixels.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { SLIDE_H, SLIDE_W, type Element, type PositionedSlide, type TextElement } from '../../schema/positioned.ts'
import { BULLET_INDENT, PARA_GAP } from '../../layout/text.ts'
import { Chart } from './Chart.tsx'
import { PX, fontStack, pt } from './units.ts'

const box = (e: Element): CSSProperties => ({
  position: 'absolute',
  left: e.x * PX,
  top: e.y * PX,
  width: e.w * PX,
  height: e.h * PX,
})

function Text({ el }: { el: TextElement }) {
  return (
    <div
      style={{
        ...box(el),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[el.valign],
        fontFamily: fontStack(el.font),
        fontSize: pt(el.size),
        lineHeight: el.lineSpacing,
        color: el.color,
        fontWeight: el.bold ? 700 : 400,
        fontStyle: el.italic ? 'italic' : 'normal',
        textAlign: el.align,
        letterSpacing: el.letterSpacing ? pt(el.letterSpacing) : undefined,
        overflowWrap: 'break-word',
      }}
    >
      {el.paragraphs.map((p, i) => {
        const indent = p.bullet ? BULLET_INDENT * ((p.level ?? 0) + 1) * PX : 0
        return (
          <p
            key={i}
            style={{
              margin: 0,
              marginTop: i ? pt(el.size) * el.lineSpacing * PARA_GAP : 0,
              paddingLeft: indent,
              textIndent: p.bullet ? -BULLET_INDENT * PX : 0,
              fontWeight: p.bold ? 700 : undefined,
              color: p.color,
            }}
          >
            {p.bullet && (
              <span style={{ display: 'inline-block', width: BULLET_INDENT * PX }}>{p.level ? '–' : '•'}</span>
            )}
            {p.text}
          </p>
        )
      })}
    </div>
  )
}

function ElementView({ el }: { el: Element }) {
  switch (el.kind) {
    case 'text':
      return <Text el={el} />
    case 'shape':
      if (el.shape === 'line')
        return (
          <div style={{ ...box(el), height: 0, borderTop: `${pt(el.line?.width ?? 1)}px solid ${el.line?.color}` }} />
        )
      return (
        <div
          style={{
            ...box(el),
            background: el.fill,
            border: el.line ? `${pt(el.line.width)}px solid ${el.line.color}` : undefined,
            borderRadius: el.shape === 'ellipse' ? '50%' : el.shape === 'roundRect' ? (el.radius ?? 0.1) * PX : 0,
            boxSizing: 'border-box',
          }}
        />
      )
    case 'image':
      return el.url ? (
        <img src={el.url} alt={el.alt} style={{ ...box(el), objectFit: 'cover', borderRadius: 0.12 * PX }} />
      ) : (
        <div
          role="img"
          aria-label={el.alt}
          style={{
            ...box(el),
            display: 'grid',
            placeItems: 'center',
            background: el.fill,
            color: el.color,
            borderRadius: 0.12 * PX,
            fontFamily: fontStack(el.font),
            fontSize: pt(14),
            textAlign: 'center',
            padding: PX * 0.3,
            boxSizing: 'border-box',
          }}
        >
          <span>
            <span style={{ fontSize: pt(40), display: 'block' }}>🖼</span>
            {el.alt}
          </span>
        </div>
      )
    case 'table':
      return (
        <table
          style={{
            ...box(el),
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            fontFamily: fontStack(el.font),
            fontSize: pt(el.size),
            color: el.color,
          }}
        >
          <thead>
            <tr style={{ background: el.headerFill, color: el.headerColor }}>
              {el.columns.map((c) => (
                <th
                  key={c}
                  style={{
                    textAlign: 'left',
                    padding: `0 ${0.12 * PX}px`,
                    border: `1px solid ${el.border}`,
                    fontWeight: 700,
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {el.rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? el.stripe : 'transparent' }}>
                {r.map((cell, j) => (
                  <td key={j} style={{ padding: `0 ${0.12 * PX}px`, border: `1px solid ${el.border}` }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'chart':
      return (
        <div style={box(el)}>
          <Chart el={el} />
        </div>
      )
  }
}

// Scales the 13.333 × 7.5 in slide to the container's width.
export function SlideView({ slide, className }: { slide: PositionedSlide; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / (SLIDE_W * PX)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={className}
      style={{ position: 'relative', aspectRatio: `${SLIDE_W} / ${SLIDE_H}`, overflow: 'hidden' }}
    >
      <div
        style={{
          position: 'absolute',
          width: SLIDE_W * PX,
          height: SLIDE_H * PX,
          background: slide.background,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {slide.elements.map((el, i) => (
          <ElementView key={i} el={el} />
        ))}
      </div>
    </div>
  )
}
