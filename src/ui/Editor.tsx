// Editor (Stitch "Slide Editor Studio"): slide navigator, the slide on a stage with a floating toolbar,
// content/notes editing, chat panel, bottom bar and present mode. Edits autosave; undo covers manual
// edits, chat edits and changes made by a coding agent.
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Download,
  Eye,
  FileJson,
  MessageSquare,
  MoreVertical,
  PenLine,
  Play,
  Plus,
  Redo2,
  StickyNote,
  Trash2,
  Undo2,
  X,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { layoutDeck } from '../layout/layout.ts'
import { THEMES } from '../layout/themes.ts'
import { SlideView } from '../render/html/SlideView.tsx'
import { THEME_IDS, type Deck, type Layout, type Slide } from '../schema/content.ts'
import { blankSlide, LAYOUTS, switchLayout } from '../schema/edit.ts'
import { parseDeck } from '../schema/parse.ts'
import type { PositionedDeck } from '../schema/positioned.ts'
import { Chat } from './Chat.tsx'
import { ContentForm } from './ContentForm.tsx'
import { deleteDeck, loadDeck, onDeckChange, saveDeck, type DeckSource } from './decks.ts'
import { navigate } from './router.ts'

type Json = Parameters<typeof ContentForm>[0]['slide']
type RawDeck = { title?: string; theme?: string; slides?: Json[] } & Record<string, unknown>

function download(name: string, blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

function Present({ deck, start, onClose }: { deck: PositionedDeck; start: number; onClose: () => void }) {
  const [i, setI] = useState(start)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    void ref.current?.requestFullscreen?.().catch(() => {})
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) setI((n) => Math.min(deck.slides.length - 1, n + 1))
      if (['ArrowLeft', 'PageUp'].includes(e.key)) setI((n) => Math.max(0, n - 1))
      if (e.key === 'Escape') onClose()
    }
    const onExit = () => !document.fullscreenElement && onClose()
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onExit)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onExit)
      if (document.fullscreenElement) void document.exitFullscreen()
    }
  }, [deck.slides.length, onClose])
  return (
    <div ref={ref} className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-label="Presentation">
      <div className="flex min-h-0 flex-1 items-center justify-center p-2">
        <div className="w-full max-w-[calc((100dvh-4rem)*16/9)]">
          <SlideView slide={deck.slides[i]} />
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 p-2 text-white/80">
        <button
          type="button"
          className="icon-btn text-white/80 hover:bg-white/10"
          onClick={() => setI(Math.max(0, i - 1))}
          aria-label="Previous slide"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <span className="font-mono text-sm">
          {i + 1} / {deck.slides.length}
        </span>
        <button
          type="button"
          className="icon-btn text-white/80 hover:bg-white/10"
          onClick={() => setI(Math.min(deck.slides.length - 1, i + 1))}
          aria-label="Next slide"
        >
          <ArrowLeft className="size-5 rotate-180" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn text-white/80 hover:bg-white/10"
          onClick={onClose}
          aria-label="Exit presentation"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export function Editor({ id }: { id: string }) {
  // The deck plus undo/redo history (newest last in `past`, next redo first in `future`).
  const [hist, setHist] = useState<{ raw: RawDeck | null; past: RawDeck[]; future: RawDeck[] }>({
    raw: null,
    past: [],
    future: [],
  })
  const raw = hist.raw
  const [source, setSource] = useState<DeckSource>('file')
  const [missing, setMissing] = useState(false)
  const [sel, setSel] = useState(0)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [notesOpen, setNotesOpen] = useState(false)
  const [present, setPresent] = useState(false)
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [banner, setBanner] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [picker, setPicker] = useState(false)
  const [tab, setTab] = useState<'slides' | 'chat'>('slides')
  const lastSave = useRef(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    let cancelled = false
    void loadDeck(id).then((meta) => {
      if (cancelled) return
      if (!meta) return setMissing(true)
      setHist({ raw: meta.deck as RawDeck, past: [], future: [] })
      setSource(meta.source)
      setSel(0)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  // A coding agent (or the CLI) changed this deck's file: reload it, keeping an undo step.
  useEffect(
    () =>
      onDeckChange((changed) => {
        if (changed !== id || Date.now() - lastSave.current < 2000) return
        void loadDeck(id).then((meta) => {
          if (!meta) return
          setHist((h) => ({
            raw: meta.deck as RawDeck,
            past: h.raw ? [...h.past, h.raw].slice(-100) : h.past,
            future: [],
          }))
          setBanner('Deck updated by your agent')
        })
      }),
    [id],
  )

  const persist = useCallback(
    (next: RawDeck) => {
      clearTimeout(saveTimer.current)
      setStatus('saving')
      saveTimer.current = setTimeout(() => {
        lastSave.current = Date.now()
        saveDeck(id, source, next)
          .then((where) => {
            setSource(where)
            setStatus('saved')
          })
          .catch(() => setStatus('error'))
      }, 500)
    },
    [id, source],
  )

  const update = useCallback(
    (next: RawDeck) => {
      setHist((h) => ({ raw: next, past: h.raw ? [...h.past, h.raw].slice(-100) : h.past, future: [] }))
      persist(next)
    },
    [persist],
  )

  const undoStep = () => {
    const prev = hist.past.at(-1)
    if (!prev || !raw) return
    setHist({ raw: prev, past: hist.past.slice(0, -1), future: [raw, ...hist.future] })
    persist(prev)
  }
  const redoStep = () => {
    const next = hist.future[0]
    if (!next || !raw) return
    setHist({ raw: next, past: [...hist.past, raw], future: hist.future.slice(1) })
    persist(next)
  }

  const parsed = useMemo(() => (raw ? parseDeck(raw) : null), [raw])
  // While the deck has an error (e.g. mid-edit), keep showing the newest version that was valid.
  const past = hist.past
  const laid = useMemo(() => {
    if (parsed?.ok) return layoutDeck(parsed.deck)
    for (let i = past.length - 1; i >= 0; i--) {
      const p = parseDeck(past[i])
      if (p.ok) return layoutDeck(p.deck)
    }
    return null
  }, [parsed, past])

  const slides = (raw?.slides ?? []) as Json[]
  const count = laid?.deck.slides.length ?? 0
  const current = Math.min(sel, Math.max(0, slides.length - 1))

  const setSlides = (next: Json[], select?: number) => {
    if (!raw) return
    update({ ...raw, slides: next })
    if (select !== undefined) setSel(select)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, select')
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        if (e.shiftKey) redoStep()
        else undoStep()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (missing)
    return (
      <div className="p-8">
        <p className="panel p-6">
          This deck doesn't exist any more.{' '}
          <a className="text-primary-ink underline" href="#/">
            Back to decks
          </a>
        </p>
      </div>
    )
  if (!raw || !laid) {
    if (parsed && !parsed.ok && raw)
      return (
        <div className="p-8">
          <div className="panel p-6">
            <h1 className="text-xl font-semibold">This deck has errors</h1>
            <ul className="mt-3 font-mono text-sm text-danger">
              {parsed.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )
    return <p className="p-8 text-ink-3">Loading…</p>
  }

  const slideErrors =
    parsed && !parsed.ok
      ? parsed.errors.filter((e) => e.startsWith(`slide ${current + 1} `) || !e.startsWith('slide'))
      : []
  const warnings = laid.warnings.filter((w) => w.slide === current + 1)
  const slide = slides[current] as (Slide & Json) | undefined
  const layout = (slide as { layout?: Layout } | undefined)?.layout ?? 'bullets'

  async function exportPptx() {
    const { buildPptx } = await import('../render/pptx/exportPptx.ts')
    await buildPptx(laid!.deck).writeFile({ fileName: `${id}.pptx` })
  }

  const navigator = (
    <nav aria-label="Slides" className="flex gap-3 overflow-auto p-3 lg:flex-col">
      <div className="hidden items-center justify-between lg:flex">
        <span className="label-code">Slide navigator</span>
        <span className="font-mono text-xs text-primary-ink">{count} slides</span>
      </div>
      {laid.deck.slides.map((s, i) => (
        <div key={i} className="group relative flex shrink-0 items-start gap-2">
          <span
            className={`hidden w-5 pt-1 font-mono text-xs lg:block ${i === current ? 'text-primary-ink' : 'text-ink-3'}`}
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => setSel(i)}
            aria-label={`Slide ${i + 1}`}
            aria-current={i === current ? 'true' : undefined}
            className={`w-36 overflow-hidden rounded border bg-surface lg:w-full ${i === current ? 'border-primary outline-2 outline-offset-2 outline-primary' : 'border-line hover:border-line-strong'}`}
          >
            <SlideView slide={s} />
          </button>
          <div className="absolute top-1 right-1 hidden gap-0.5 rounded bg-surface/90 p-0.5 shadow group-focus-within:flex group-hover:flex">
            <button
              type="button"
              className="icon-btn size-7"
              aria-label={`Move slide ${i + 1} up`}
              disabled={i === 0}
              onClick={() =>
                setSlides(
                  slides.map((x, j) => (j === i - 1 ? slides[i] : j === i ? slides[i - 1] : x)),
                  i - 1,
                )
              }
            >
              <ArrowUp className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-btn size-7"
              aria-label={`Move slide ${i + 1} down`}
              disabled={i === slides.length - 1}
              onClick={() =>
                setSlides(
                  slides.map((x, j) => (j === i + 1 ? slides[i] : j === i ? slides[i + 1] : x)),
                  i + 1,
                )
              }
            >
              <ArrowDown className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
      <div className="relative shrink-0">
        <button
          type="button"
          className="btn-ghost w-36 lg:w-full"
          onClick={() => setPicker(!picker)}
          aria-expanded={picker}
        >
          <Plus className="size-4" aria-hidden="true" /> Add slide
        </button>
        {picker && (
          <div className="absolute bottom-11 left-0 z-20 grid w-56 grid-cols-2 gap-1 rounded-lg border border-line-strong bg-surface p-1.5 shadow-lg">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                type="button"
                className="rounded px-2 py-1.5 text-left text-sm hover:bg-rail"
                onClick={() => {
                  setSlides(
                    [...slides.slice(0, current + 1), blankSlide(l.id) as Json, ...slides.slice(current + 1)],
                    current + 1,
                  )
                  setPicker(false)
                }}
              >
                {l.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  )

  const chat = <Chat deckId={id} raw={raw} selected={current} onApply={(next) => update(next)} />

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2 lg:px-5">
        <a href="#/" className="icon-btn" aria-label="Back to decks">
          <ArrowLeft className="size-5" aria-hidden="true" />
        </a>
        <h1 className="sr-only">{raw.title || 'Untitled deck'}</h1>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Deck title</span>
          <input
            className="w-full truncate rounded border border-transparent bg-transparent px-1.5 py-1 text-lg font-medium tracking-tight hover:border-line focus:border-primary focus:outline-none lg:text-xl"
            value={raw.title ?? ''}
            onChange={(e) => update({ ...raw, title: e.target.value })}
          />
        </label>
        <span
          className="hidden items-center gap-1.5 rounded-full bg-rail px-2.5 py-1 font-mono text-[11px] text-ink-2 sm:flex"
          role="status"
        >
          <span
            className={`size-1.5 rounded-full ${status === 'error' ? 'bg-danger' : status === 'saving' ? 'bg-ai' : 'bg-ok'}`}
            aria-hidden="true"
          />
          {status === 'error'
            ? 'Not saved'
            : status === 'saving'
              ? 'Saving…'
              : source === 'file'
                ? 'Saved to disk'
                : 'Saved in browser'}
        </span>
        <button type="button" className="icon-btn" aria-label="Undo" disabled={!hist.past.length} onClick={undoStep}>
          <Undo2 className="size-4" aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" aria-label="Redo" disabled={!hist.future.length} onClick={redoStep}>
          <Redo2 className="size-4" aria-hidden="true" />
        </button>
        <label>
          <span className="sr-only">Theme</span>
          <select
            className="field h-9 w-auto"
            value={String(raw.theme ?? 'slate')}
            onChange={(e) => update({ ...raw, theme: e.target.value })}
          >
            {THEME_IDS.map((t) => (
              <option key={t} value={t}>
                {THEMES[t].name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-primary"
          onClick={exportPptx}
          disabled={!parsed?.ok}
          aria-label="Export PPTX"
        >
          <Download className="size-4" aria-hidden="true" /> <span className="hidden sm:inline">Export PPTX</span>
        </button>
        <div className="relative">
          <button
            type="button"
            className="icon-btn"
            aria-label="More"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <MoreVertical className="size-5" aria-hidden="true" />
          </button>
          {menu && (
            <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-line-strong bg-surface p-1 shadow-lg">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-rail"
                onClick={() => {
                  download(`${id}.json`, new Blob([JSON.stringify(raw, null, 2)], { type: 'application/json' }))
                  setMenu(false)
                }}
              >
                <FileJson className="size-4" aria-hidden="true" /> Export JSON
              </button>
              {source !== 'example' && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-danger hover:bg-danger-soft"
                  onClick={async () => {
                    if (!confirm(`Delete "${raw.title}"?`)) return
                    await deleteDeck(id, source)
                    navigate('/')
                  }}
                >
                  <Trash2 className="size-4" aria-hidden="true" /> Delete deck
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {banner && (
        <div
          className="flex items-center gap-2 border-b border-line bg-ai-soft px-4 py-2 font-mono text-xs text-ai-ink"
          role="status"
        >
          <Zap className="size-3.5" aria-hidden="true" /> {banner}
          <button type="button" className="ml-auto underline" onClick={undoStep}>
            Undo
          </button>
          <button type="button" className="icon-btn size-7" aria-label="Dismiss" onClick={() => setBanner(null)}>
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex border-b border-line bg-surface lg:hidden" role="tablist">
        {(['slides', 'chat'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-primary text-primary-ink' : 'text-ink-2'}`}
          >
            {t === 'slides' ? 'Slides' : 'AI chat'}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_340px]">
        <div
          className={`min-h-0 border-line bg-rail lg:block lg:overflow-auto lg:border-r ${tab === 'chat' ? 'hidden' : ''}`}
        >
          {navigator}
        </div>

        <div className={`min-w-0 overflow-auto ${tab === 'chat' ? 'hidden lg:block' : ''}`}>
          <div className="mx-auto flex max-w-4xl flex-col gap-4 p-3 lg:p-8">
            <div className="flex flex-wrap items-center gap-1 self-center rounded-xl border border-line-strong bg-surface p-1 shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
              <label>
                <span className="sr-only">Layout</span>
                <select
                  className="field h-8 w-auto border-transparent"
                  value={layout}
                  onChange={(e) =>
                    slide &&
                    setSlides(
                      slides.map((x, i) =>
                        i === current ? (switchLayout(slide as Slide, e.target.value as Layout) as Json) : x,
                      ),
                    )
                  }
                >
                  {LAYOUTS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="icon-btn"
                aria-label="Duplicate slide"
                onClick={() =>
                  setSlides(
                    [...slides.slice(0, current + 1), structuredClone(slides[current]), ...slides.slice(current + 1)],
                    current + 1,
                  )
                }
              >
                <Copy className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Delete slide"
                disabled={slides.length < 2}
                onClick={() =>
                  setSlides(
                    slides.filter((_, i) => i !== current),
                    Math.max(0, current - 1),
                  )
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`btn h-8 ${notesOpen ? 'bg-rail text-ink' : 'text-ink-2'}`}
                aria-pressed={notesOpen}
                onClick={() => setNotesOpen(!notesOpen)}
              >
                <StickyNote className="size-4" aria-hidden="true" /> Notes
              </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-[rgba(100,116,139,0.16)] shadow-[0_1px_3px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.03)]">
              {laid.deck.slides[current] && <SlideView slide={laid.deck.slides[current]} />}
            </div>

            {(slideErrors.length > 0 || warnings.length > 0) && (
              <ul className="rounded-lg bg-warn-soft p-3 text-sm text-warn-ink" role="status">
                {slideErrors.map((e) => (
                  <li key={e} className="font-mono">
                    {e} — showing the last valid version
                  </li>
                ))}
                {warnings.map((w) => (
                  <li key={w.message}>{w.message}</li>
                ))}
              </ul>
            )}

            {notesOpen && slide && (
              <label className="panel flex flex-col gap-2 p-4">
                <span className="flex items-center gap-2 font-medium">
                  <StickyNote className="size-4" aria-hidden="true" /> Speaker notes
                </span>
                <textarea
                  className="field h-auto min-h-24 py-2"
                  value={String((slide as { notes?: string }).notes ?? '')}
                  onChange={(e) =>
                    setSlides(
                      slides.map((x, i) =>
                        i === current ? { ...(x as object), notes: e.target.value || undefined } : x,
                      ) as Json[],
                    )
                  }
                />
              </label>
            )}

            {mode === 'edit' && slide && (
              <section className="panel p-4" aria-label="Slide content">
                <ContentForm
                  slide={slide}
                  onChange={(next) => setSlides(slides.map((x, i) => (i === current ? next : x)))}
                />
              </section>
            )}
          </div>
        </div>

        <aside
          className={`min-h-0 overflow-auto border-line bg-surface lg:block lg:border-l ${tab === 'chat' ? '' : 'hidden'}`}
          aria-label="AI chat"
        >
          {chat}
        </aside>
      </div>

      <div className="flex items-center gap-2 border-t border-line bg-surface px-3 py-2">
        <button type="button" className="btn-primary" onClick={() => setPresent(true)} disabled={!count}>
          <Play className="size-4" aria-hidden="true" /> Present
        </button>
        <div className="flex rounded border border-line p-0.5" role="group" aria-label="Mode">
          {(['edit', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`btn h-8 ${mode === m ? 'bg-rail text-ink' : 'text-ink-2'}`}
            >
              {m === 'edit' ? (
                <PenLine className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
              {m === 'edit' ? 'Edit' : 'Preview'}
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn lg:hidden" aria-label="AI chat" onClick={() => setTab('chat')}>
          <MessageSquare className="size-5" aria-hidden="true" />
        </button>
        <span className="ml-auto font-mono text-xs text-ink-2">
          Slide {current + 1} of {count}
        </span>
      </div>

      {present && <Present deck={laid.deck} start={current} onClose={() => setPresent(false)} />}
    </div>
  )
}

export type { RawDeck, Deck }
