// Temporary deck viewer (until the editor UI in TASK-006): pick a deck from decks/, see its slides,
// validation errors and fit warnings, and watch it update live when the file changes.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { layoutDeck } from './layout/layout.ts'
import { THEMES } from './layout/themes.ts'
import { THEME_IDS, type ThemeId } from './schema/content.ts'
import { parseDeck, type ParseResult } from './schema/parse.ts'
import { SlideView } from './render/html/SlideView.tsx'

type DeckInfo = { name: string; updated: string }

export default function App() {
  const [decks, setDecks] = useState<DeckInfo[]>([])
  const [current, setCurrent] = useState(() => new URLSearchParams(location.search).get('deck'))
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [theme, setTheme] = useState<ThemeId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadList = useCallback(
    () =>
      fetch('/api/decks')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((list: DeckInfo[]) => {
          setDecks(list)
          setCurrent((c) => c ?? list[0]?.name ?? null)
        })
        .catch(() => setError('Local server not reachable. Run npm run dev.')),
    [],
  )

  const loadDeck = useCallback((name: string) => {
    fetch(`/api/decks/${name}`)
      .then((r) => r.json())
      .then((json: unknown) => setParsed(parseDeck(json)))
      .catch(() => setParsed({ ok: false, errors: ['The file is not valid JSON.'] }))
  }, [])

  useEffect(() => {
    loadList()
    const events = new EventSource('/api/events')
    events.addEventListener('deck', (e) => {
      const { name } = JSON.parse((e as MessageEvent).data) as { name: string }
      loadList()
      setCurrent((c) => {
        if (c === name) loadDeck(name)
        return c
      })
    })
    return () => events.close()
  }, [loadList, loadDeck])

  useEffect(() => {
    if (current) loadDeck(current)
  }, [current, loadDeck])

  const laid = useMemo(
    () => (parsed?.ok ? layoutDeck({ ...parsed.deck, theme: theme ?? parsed.deck.theme }) : null),
    [parsed, theme],
  )

  return (
    <main className="min-h-screen bg-slate-100 p-6 font-sans text-slate-800">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">slidecraft preview</h1>
        <select
          className="rounded border bg-white px-2 py-1"
          value={current ?? ''}
          onChange={(e) => setCurrent(e.target.value)}
          aria-label="Deck"
        >
          {decks.map((d) => (
            <option key={d.name}>{d.name}</option>
          ))}
        </select>
        <select
          className="rounded border bg-white px-2 py-1"
          value={theme ?? ''}
          onChange={(e) => setTheme((e.target.value || null) as ThemeId | null)}
          aria-label="Theme"
        >
          <option value="">Deck theme</option>
          {THEME_IDS.map((id) => (
            <option key={id} value={id}>
              {THEMES[id].name}
            </option>
          ))}
        </select>
      </header>

      <div className="mx-auto mt-6 flex max-w-5xl flex-col gap-6">
        {error && <p className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
        {parsed && !parsed.ok && (
          <ul className="rounded bg-red-50 p-3 font-mono text-sm text-red-700">
            {parsed.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {laid?.warnings.length ? (
          <ul className="rounded bg-amber-50 p-3 text-sm text-amber-800">
            {laid.warnings.map((w, i) => (
              <li key={i}>
                Slide {w.slide}: {w.message}
              </li>
            ))}
          </ul>
        ) : null}
        {laid?.deck.slides.map((slide, i) => (
          <SlideView key={i} slide={slide} className="rounded-md shadow ring-1 ring-black/5" />
        ))}
      </div>
    </main>
  )
}
