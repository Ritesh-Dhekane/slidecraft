// Edits a slide's content by walking its data: strings become inputs (long ones textareas), number lists
// become numeric fields, string lists and object lists can be added to and removed from, table rows
// become a grid. Works for every layout without a form per layout.
import { Minus, Plus } from 'lucide-react'

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }
type Props = { value: Json; onChange: (v: Json) => void; path: string; label: string }

const LONG = new Set(['text', 'subtitle', 'quote', 'caption', 'notes', 'prompt'])
const ENUMS: Record<string, string[]> = { type: ['column', 'bar', 'line', 'pie'] }
const HIDDEN = new Set(['layout', 'notes'])
const LABELS: Record<string, string> = { sub: 'Sub-points', url: 'Image URL', alt: 'Description', prompt: 'Image idea' }

const nice = (key: string) => LABELS[key] ?? key.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

// An empty copy of an example item, for "add".
function blankLike(v: Json): Json {
  if (typeof v === 'string') return ''
  if (typeof v === 'number') return 0
  if (Array.isArray(v)) return v.length && typeof v[0] !== 'object' ? v.map(blankLike) : []
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blankLike(x)]))
  return v
}

function ListField({ value, onChange, path, label }: Props & { value: Json[] }) {
  const isRows = value.length > 0 && Array.isArray(value[0])
  if (isRows) {
    return (
      <fieldset className="flex flex-col gap-1.5">
        <legend className="label-code mb-1">{label}</legend>
        {value.map((row, r) => (
          <div key={r} className="flex gap-1.5">
            {(row as Json[]).map((cell, c) => (
              <input
                key={c}
                aria-label={`${label} row ${r + 1} cell ${c + 1}`}
                className="field h-8 min-w-0"
                value={String(cell ?? '')}
                onChange={(e) =>
                  onChange(
                    value.map((x, i) => (i === r ? (x as Json[]).map((y, j) => (j === c ? e.target.value : y)) : x)),
                  )
                }
              />
            ))}
            <button
              type="button"
              className="icon-btn size-8 shrink-0"
              aria-label={`Remove row ${r + 1}`}
              onClick={() => onChange(value.filter((_, i) => i !== r))}
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        <button type="button" className="chip self-start" onClick={() => onChange([...value, blankLike(value[0])])}>
          <Plus className="size-3.5" aria-hidden="true" /> Row
        </button>
      </fieldset>
    )
  }
  const numbers = value.length > 0 && value.every((v) => typeof v === 'number')
  if (numbers) {
    return (
      <label className="flex flex-col gap-1">
        <span className="label-code">{label}</span>
        <input
          className="field font-mono"
          defaultValue={value.join(', ')}
          onChange={(e) => onChange(e.target.value.split(',').map((n) => Number(n.trim()) || 0))}
          aria-describedby={`${path}-hint`}
        />
        <span id={`${path}-hint`} className="text-xs text-ink-3">
          Numbers separated by commas
        </span>
      </label>
    )
  }
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="label-code mb-1">{label}</legend>
      {value.map((item, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <Field
              value={item}
              onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))}
              path={`${path}-${i}`}
              label={`${label} ${i + 1}`}
            />
          </div>
          <button
            type="button"
            className="icon-btn size-8 shrink-0"
            aria-label={`Remove ${label} ${i + 1}`}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="chip self-start"
        onClick={() => onChange([...value, value.length ? blankLike(value[0]) : ''])}
      >
        <Plus className="size-3.5" aria-hidden="true" /> Add
      </button>
    </fieldset>
  )
}

function Field({ value, onChange, path, label }: Props) {
  const key = path.split('-').at(-1) ?? ''
  if (Array.isArray(value)) return <ListField value={value} onChange={onChange} path={path} label={label} />
  if (value && typeof value === 'object') {
    return (
      <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-3">
        {!/\d$/.test(path) && <legend className="label-code px-1">{label}</legend>}
        {Object.entries(value)
          .filter(([k]) => !HIDDEN.has(k))
          .map(([k, v]) => (
            <Field
              key={k}
              value={v}
              onChange={(nv) => onChange({ ...value, [k]: nv })}
              path={`${path}-${k}`}
              label={nice(k)}
            />
          ))}
      </fieldset>
    )
  }
  if (typeof value === 'number') {
    return (
      <label className="flex flex-col gap-1">
        <span className="label-code">{label}</span>
        <input type="number" className="field" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </label>
    )
  }
  const text = String(value ?? '')
  if (ENUMS[key]) {
    return (
      <label className="flex flex-col gap-1">
        <span className="label-code">{label}</span>
        <select className="field" value={text} onChange={(e) => onChange(e.target.value)}>
          {ENUMS[key].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
    )
  }
  const long = LONG.has(key) || text.length > 70
  const inList = /\d$/.test(path)
  return (
    <label className="flex flex-col gap-1">
      <span className={inList ? 'sr-only' : 'label-code'}>{label}</span>
      {long ? (
        <textarea
          className="field h-auto min-h-16 py-1.5"
          rows={2}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input className="field" value={text} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

// Optional fields each layout can have, with a starting value, offered as "+ field" chips.
const OPTIONAL: Record<string, Record<string, Json>> = {
  title: { kicker: 'Label', subtitle: 'Subtitle' },
  section: { kicker: 'Part 1', subtitle: 'Subtitle' },
  bullets: { kicker: 'Label' },
  'two-column': { kicker: 'Label' },
  comparison: { kicker: 'Label' },
  table: { kicker: 'Label', caption: 'Source or note' },
  chart: { kicker: 'Label', takeaways: ['Key takeaway'] },
  'image-text': { kicker: 'Label', text: 'Short description', bullets: ['Point'] },
  stats: { kicker: 'Label' },
  quote: { author: 'Author', role: 'Role' },
  closing: { kicker: 'Label', subtitle: 'Questions?' },
}

export function ContentForm({ slide, onChange }: { slide: Json; onChange: (slide: Json) => void }) {
  if (!slide || typeof slide !== 'object' || Array.isArray(slide)) return null
  const missing = Object.entries(OPTIONAL[String(slide.layout)] ?? {}).filter(([k]) => !(k in slide))
  return (
    <div className="flex flex-col gap-3">
      {missing.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {missing.map(([k, v]) => (
            <button key={k} type="button" className="chip" onClick={() => onChange({ ...slide, [k]: v })}>
              <Plus className="size-3.5" aria-hidden="true" /> {nice(k)}
            </button>
          ))}
        </div>
      )}
      {Object.entries(slide)
        .filter(([k]) => !HIDDEN.has(k))
        .map(([k, v]) => (
          <Field key={k} value={v} onChange={(nv) => onChange({ ...slide, [k]: nv })} path={`f-${k}`} label={nice(k)} />
        ))}
    </div>
  )
}
