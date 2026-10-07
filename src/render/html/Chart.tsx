// SVG chart for the preview, styled to match the native PowerPoint chart the PPTX export creates
// (column/bar/line/pie, legend on top, light value grid). Drawn in a viewBox the size of the element
// in pixels at 96 px/in, so text sizes line up with the rest of the slide.
import type { ChartElement } from '../../schema/positioned.ts'
import { PX, pt } from './units.ts'

function niceMax(v: number) {
  if (v <= 0) return 1
  const step = 10 ** Math.floor(Math.log10(v))
  return Math.ceil(v / step) * step
}

export function Chart({ el }: { el: ChartElement }) {
  const W = el.w * PX
  const H = el.h * PX
  const font = { fontFamily: `"${el.font}", system-ui, sans-serif`, fontSize: pt(el.size), fill: el.color }
  const legendH = el.series.length > 1 || el.type === 'pie' ? pt(el.size) * 2 : 0
  const legendItems = el.type === 'pie' ? el.labels : el.series.map((s) => s.name)
  const legend = legendH ? (
    <g>
      {legendItems.map((name, i) => (
        <g key={name} transform={`translate(${i * 150}, 0)`}>
          <rect
            width={pt(el.size) * 0.8}
            height={pt(el.size) * 0.8}
            y={2}
            rx={2}
            fill={el.colors[i % el.colors.length]}
          />
          <text x={pt(el.size) * 1.2} y={pt(el.size) * 0.85} style={font}>
            {name}
          </text>
        </g>
      ))}
    </g>
  ) : null

  if (el.type === 'pie') {
    const values = el.series[0].values
    const total = values.reduce((a, b) => a + Math.max(0, b), 0) || 1
    const r = Math.min(W, H - legendH) / 2 - 8
    const cx = W / 2
    const cy = legendH + (H - legendH) / 2
    let angle = -Math.PI / 2
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label={el.labels.join(', ')}>
        {legend}
        {values.map((v, i) => {
          const a = (Math.max(0, v) / total) * Math.PI * 2
          const [x1, y1] = [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
          angle += a
          const [x2, y2] = [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
          return (
            <path
              key={i}
              d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x2},${y2} Z`}
              fill={el.colors[i % el.colors.length]}
              stroke="#fff"
              strokeWidth={2}
            />
          )
        })}
      </svg>
    )
  }

  const max = niceMax(Math.max(...el.series.flatMap((s) => s.values)))
  const left = pt(el.size) * 3.2
  const bottom = pt(el.size) * 2
  const top = legendH + pt(el.size)
  const plotW = W - left - 10
  const plotH = H - top - bottom
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const horizontal = el.type === 'bar'
  const n = el.labels.length
  const band = (horizontal ? plotH : plotW) / n
  const barW = (band * 0.7) / el.series.length
  const scale = (v: number) => (v / max) * (horizontal ? plotW : plotH)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label={`${el.type} chart`}>
      {legend}
      {ticks.map((t) => {
        const label = `${Math.round(max * t)}${el.unit ?? ''}`
        return horizontal ? (
          <g key={t}>
            <line x1={left + plotW * t} x2={left + plotW * t} y1={top} y2={top + plotH} stroke={el.grid} />
            <text x={left + plotW * t} y={top + plotH + pt(el.size) * 1.3} textAnchor="middle" style={font}>
              {label}
            </text>
          </g>
        ) : (
          <g key={t}>
            <line x1={left} x2={left + plotW} y1={top + plotH * (1 - t)} y2={top + plotH * (1 - t)} stroke={el.grid} />
            <text x={left - 8} y={top + plotH * (1 - t) + pt(el.size) * 0.35} textAnchor="end" style={font}>
              {label}
            </text>
          </g>
        )
      })}
      {el.labels.map((label, i) =>
        horizontal ? (
          <text key={label} x={left - 8} y={top + band * (i + 0.5) + pt(el.size) * 0.35} textAnchor="end" style={font}>
            {label}
          </text>
        ) : (
          <text
            key={label}
            x={left + band * (i + 0.5)}
            y={top + plotH + pt(el.size) * 1.4}
            textAnchor="middle"
            style={font}
          >
            {label}
          </text>
        ),
      )}
      {el.type === 'line'
        ? el.series.map((s, si) => (
            <polyline
              key={s.name}
              fill="none"
              stroke={el.colors[si % el.colors.length]}
              strokeWidth={3}
              points={s.values.map((v, i) => `${left + band * (i + 0.5)},${top + plotH - scale(v)}`).join(' ')}
            />
          ))
        : el.series.map((s, si) =>
            s.values.map((v, i) => {
              const offset = band * 0.15 + si * barW
              return horizontal ? (
                <rect
                  key={`${si}-${i}`}
                  x={left}
                  y={top + band * i + offset}
                  width={scale(v)}
                  height={barW}
                  fill={el.colors[si % el.colors.length]}
                />
              ) : (
                <rect
                  key={`${si}-${i}`}
                  x={left + band * i + offset}
                  y={top + plotH - scale(v)}
                  width={barW}
                  height={scale(v)}
                  fill={el.colors[si % el.colors.length]}
                />
              )
            }),
          )}
    </svg>
  )
}
