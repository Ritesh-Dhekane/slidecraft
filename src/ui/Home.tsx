// Home (Stitch "Create & Orchestrate Decks"): prompt card to generate a deck with Gemini, the coding-agent
// card, and the recent decks grid with real first-slide thumbnails.
import { Check, Copy, FileJson, MoreVertical, Plus, Sparkles, Terminal, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { layoutDeck } from '../layout/layout.ts'
import { THEMES } from '../layout/themes.ts'
import { SlideView } from '../render/html/SlideView.tsx'
import { THEME_IDS, type ThemeId } from '../schema/content.ts'
import { newDeck, slugify } from '../schema/edit.ts'
import { parseDeck } from '../schema/parse.ts'
import { createDeck, deleteDeck, type DeckMeta } from './decks.ts'
import { openSettings } from './events.ts'
import { formatTokens, usePrefs } from './prefs.ts'
import { deckHref, navigate } from './router.ts'

const SUGGESTIONS = [
  '10 slides on Selenium vs Cypress for my MCA project',
  'Pitch deck for a study app',
  'Lecture on binary search trees',
]
const COUNTS = [5, 7, 10, 15]

export type GenerateRequest = { prompt: string; slides: number; theme: ThemeId }

function DeckCard({ meta, onChanged }: { meta: DeckMeta; onChanged: () => void }) {
  const [menu, setMenu] = useState(false)
  const parsed = useMemo(() => parseDeck(meta.deck), [meta.deck])
  const first = useMemo(
    () => (parsed.ok ? layoutDeck({ ...parsed.deck, slides: parsed.deck.slides.slice(0, 1) }).deck.slides[0] : null),
    [parsed],
  )
  const title = parsed.ok ? parsed.deck.title : ((meta.deck as { title?: string } | null)?.title ?? meta.id)
  const badge = { file: 'File', browser: 'Browser', example: 'Example' }[meta.source]
  return (
    <li className="panel relative overflow-hidden transition-shadow hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
      <a href={deckHref(meta.id)} className="block">
        <div className="relative border-b border-line bg-rail">
          {first ? (
            <SlideView slide={first} />
          ) : (
            <div className="grid aspect-video place-items-center text-sm text-danger">Needs fixing</div>
          )}
          <span className="absolute top-2 left-2 rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] text-on-primary">
            {badge}
          </span>
        </div>
        <div className="p-3 pr-10">
          <p className="truncate font-medium text-ink">{title}</p>
          <p className="mt-1 font-mono text-[11px] text-ink-3">
            {parsed.ok ? `${parsed.deck.slides.length} slides` : 'invalid'}
            {meta.updated && ` · ${new Date(meta.updated).toLocaleDateString()}`}
          </p>
        </div>
      </a>
      {meta.source !== 'example' && (
        <div className="absolute right-1.5 bottom-2">
          <button
            type="button"
            className="icon-btn"
            aria-label={`More actions for ${title}`}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </button>
          {menu && (
            <div className="absolute right-0 bottom-10 z-10 w-36 rounded-lg border border-line-strong bg-surface p-1 shadow-lg">
              <button
                type="button"
                className="w-full rounded px-2 py-1.5 text-left text-sm text-danger hover:bg-danger-soft"
                onClick={async () => {
                  if (!confirm(`Delete "${title}"?`)) return
                  await deleteDeck(meta.id, meta.source)
                  onChanged()
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function AgentCard() {
  const [copied, setCopied] = useState(false)
  const command = 'npm run dev'
  return (
    <section aria-labelledby="agent-h" className="flex flex-col gap-4 rounded-lg bg-[#17273b] p-6 text-slate-100">
      <p className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-slate-400 uppercase">
        <Terminal className="size-4" aria-hidden="true" /> Developer interface
      </p>
      <h2 id="agent-h" className="text-xl font-semibold tracking-tight">
        Prefer your coding agent?
      </h2>
      <p className="text-sm text-slate-300">
        Open this project in <strong className="text-white">Claude Code</strong>,{' '}
        <strong className="text-white">Codex</strong> or <strong className="text-white">Antigravity</strong> and ask it
        to make a deck. It writes <code className="font-mono">decks/*.json</code> and the deck appears here live.
      </p>
      <div className="flex items-center justify-between rounded border border-slate-600 bg-slate-900/50 px-3 py-2 font-mono text-sm">
        <span>$ {command}</span>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-slate-300 hover:text-white"
          onClick={() => {
            void navigator.clipboard.writeText(command)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}{' '}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <ol className="flex flex-col gap-2 text-sm">
        {[
          'Run the local app',
          'Ask your agent for a deck (it reads AGENTS.md)',
          'Watch it update here, then export',
        ].map((t, i) => (
          <li key={t} className="flex items-center gap-3">
            <span className="grid size-6 place-items-center rounded-full bg-ai font-mono text-xs text-white">
              {i + 1}
            </span>{' '}
            {t}
          </li>
        ))}
      </ol>
    </section>
  )
}

export function Home({
  decks,
  query,
  onChanged,
  onGenerate,
  busy,
}: {
  decks: DeckMeta[] | null
  query: string
  onChanged: () => void
  onGenerate: (r: GenerateRequest) => void
  busy: boolean
}) {
  const prefs = usePrefs()
  const [prompt, setPrompt] = useState('')
  const [slides, setSlides] = useState(10)
  const [theme, setTheme] = useState<ThemeId>('slate')
  const lastRun = prefs.usage.at(-1)
  const shown = (decks ?? []).filter((d) => {
    const title = (d.deck as { title?: string } | null)?.title ?? d.id
    return !query || title.toLowerCase().includes(query.toLowerCase())
  })

  async function blank() {
    const deck = newDeck()
    navigate(deckHref(await createDeck(slugify(deck.title), deck)).slice(1))
  }

  async function importJson(file: File) {
    const deck: unknown = JSON.parse(await file.text())
    const title = (deck as { title?: string }).title ?? file.name
    navigate(deckHref(await createDeck(slugify(title), deck)).slice(1))
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-4 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-code">Studio · Workspace</p>
          <h1 className="mt-1 text-[28px] leading-9 font-semibold tracking-tight lg:text-[40px] lg:leading-[48px]">
            Create decks
          </h1>
        </div>
        <div className="flex gap-2">
          <label className="btn-ghost cursor-pointer">
            <Upload className="size-4" aria-hidden="true" /> Import JSON
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
            />
          </label>
          <button type="button" className="btn-primary" onClick={blank}>
            <Plus className="size-4" aria-hidden="true" /> New deck
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <form
          className="panel flex flex-col gap-4 p-5 lg:p-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (prompt.trim()) onGenerate({ prompt: prompt.trim(), slides, theme })
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-medium">
              <Sparkles className="size-5 text-ai" aria-hidden="true" /> Describe your presentation…
            </h2>
            <span className="rounded border border-[#d8b4fe] bg-ai-soft px-2 py-0.5 font-mono text-[11px] text-ai-ink">
              {prefs.geminiModel}
            </span>
          </div>
          <label htmlFor="prompt" className="sr-only">
            Describe your presentation
          </label>
          <textarea
            id="prompt"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. 10 slides on Selenium vs Cypress for my MCA project: architecture, speed, reliability and when to use each."
            className="w-full resize-y rounded-lg border border-line-strong bg-canvas p-3 text-base text-ink outline-none focus:border-primary"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-code">Suggestions:</span>
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => setPrompt(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-rail p-3">
            <fieldset className="flex items-center gap-1">
              <legend className="label-code mr-2 float-left">Slides:</legend>
              {COUNTS.map((n) => (
                <label
                  key={n}
                  className={`cursor-pointer rounded px-2 py-1 font-mono text-sm has-[:checked]:bg-surface has-[:checked]:font-bold has-[:checked]:text-ink ${'text-ink-3'}`}
                >
                  <input
                    type="radio"
                    name="count"
                    className="sr-only"
                    checked={slides === n}
                    onChange={() => setSlides(n)}
                  />
                  {n}
                </label>
              ))}
            </fieldset>
            <label className="flex items-center gap-2">
              <span className="label-code">Style:</span>
              <select className="field h-8 w-auto" value={theme} onChange={(e) => setTheme(e.target.value as ThemeId)}>
                {THEME_IDS.map((id) => (
                  <option key={id} value={id}>
                    {THEMES[id].name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" className="btn-ai h-11 px-5" disabled={busy || !prompt.trim()}>
              {busy ? 'Generating…' : 'Generate presentation'} <Sparkles className="size-4" aria-hidden="true" />
            </button>
            <p className="font-mono text-xs text-ink-3">
              {prefs.geminiKey ? 'Uses your Gemini key' : 'Needs your Gemini API key'}
              {lastRun && ` · ${formatTokens(lastRun.input + lastRun.output)} tokens last run`} ·{' '}
              <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={openSettings}>
                {prefs.geminiKey ? 'Settings' : 'Add key'}
              </button>
            </p>
          </div>
        </form>
        <AgentCard />
      </div>

      <section aria-labelledby="recent-h">
        <h2 id="recent-h" className="mb-4 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          Recent decks <span className="rounded bg-rail px-2 font-mono text-sm text-ink-2">{shown.length}</span>
        </h2>
        {decks === null ? (
          <p className="text-ink-3">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="panel flex items-center gap-2 p-6 text-ink-2">
            <FileJson className="size-5" aria-hidden="true" />{' '}
            {query ? 'No decks match your search.' : 'No decks yet — describe one above or ask your coding agent.'}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {shown.map((d) => (
              <DeckCard key={d.id} meta={d} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
