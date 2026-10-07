// slidecraft app: home (deck list + prompt) and the editor, with settings as a dialog.
import { useCallback, useEffect, useState } from 'react'
import { listDecks, onDeckChange, type DeckMeta } from './ui/decks.ts'
import { Editor } from './ui/Editor.tsx'
import { onOpenSettings } from './ui/events.ts'
import { Home, type GenerateRequest } from './ui/Home.tsx'
import { applyAppearance } from './ui/prefs.ts'
import { useRoute } from './ui/router.ts'
import { Settings } from './ui/Settings.tsx'
import { Shell } from './ui/Shell.tsx'

applyAppearance()
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyAppearance)

export default function App() {
  const route = useRoute()
  const [decks, setDecks] = useState<DeckMeta[] | null>(null)
  const [query, setQuery] = useState('')
  const [settings, setSettings] = useState(false)

  const refresh = useCallback(() => {
    void listDecks().then(setDecks)
  }, [])

  useEffect(() => {
    refresh()
    const off = onDeckChange(refresh)
    const offSettings = onOpenSettings(() => setSettings(true))
    return () => {
      off()
      offSettings()
    }
  }, [refresh])

  // Gemini generation arrives in TASK-007; until then the prompt opens settings.
  const generate = (_r: GenerateRequest) => setSettings(true)

  const lastDeck = route.name === 'deck' ? route.id : (decks?.[0]?.id ?? null)
  const title =
    route.name === 'deck'
      ? ((decks?.find((d) => d.id === route.id)?.deck as { title?: string } | undefined)?.title ?? route.id)
      : null
  const crumb = (
    <span>
      <a href="#/" className="hover:text-ink">
        Decks
      </a>
      {title && <span className="text-ink"> / {title}</span>}
    </span>
  )

  return (
    <>
      <Shell crumb={crumb} query={query} onQuery={setQuery} lastDeck={lastDeck}>
        {route.name === 'deck' ? (
          <Editor key={route.id} id={route.id} />
        ) : (
          <Home decks={decks} query={query} onChanged={refresh} onGenerate={generate} busy={false} />
        )}
      </Shell>
      {settings && <Settings onClose={() => setSettings(false)} />}
    </>
  )
}
