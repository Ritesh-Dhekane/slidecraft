// Where decks live: as files in decks/ when the local server is running (shared with coding agents and
// the CLI), otherwise in this browser (localStorage) — e.g. on the GitHub Pages demo. The bundled example
// deck is always available.
import example from '../../decks/example-selenium-vs-cypress.json'

export type DeckSource = 'file' | 'browser' | 'example'
export type DeckMeta = { id: string; source: DeckSource; updated: string; deck: unknown }

const API = `${import.meta.env.BASE_URL}api`
const LOCAL_KEY = 'slidecraft.decks'
export const EXAMPLE_ID = 'example-selenium-vs-cypress'

let serverCheck: Promise<boolean> | null = null
export function hasServer(): Promise<boolean> {
  serverCheck ??= fetch(`${API}/health`)
    .then((r) => r.ok)
    .catch(() => false)
  return serverCheck
}

type LocalStore = Record<string, { deck: unknown; updated: string }>
function readLocal(): LocalStore {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}') as LocalStore
  } catch {
    return {}
  }
}
function writeLocal(store: LocalStore) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(store))
}

export async function listDecks(): Promise<DeckMeta[]> {
  const local = Object.entries(readLocal()).map(([id, v]) => ({ id, source: 'browser' as const, ...v }))
  let files: DeckMeta[] = []
  if (await hasServer()) {
    const list = (await (await fetch(`${API}/decks`)).json()) as { name: string; updated: string }[]
    files = await Promise.all(
      list.map(async (d) => ({
        id: d.name,
        source: 'file' as const,
        updated: d.updated,
        deck: await fetch(`${API}/decks/${d.name}`)
          .then((r) => r.json())
          .catch(() => null),
      })),
    )
  }
  const all = [...files, ...local]
  if (!all.some((d) => d.id === EXAMPLE_ID)) all.push({ id: EXAMPLE_ID, source: 'example', updated: '', deck: example })
  return all.sort((a, b) => b.updated.localeCompare(a.updated))
}

export async function loadDeck(id: string): Promise<DeckMeta | null> {
  const local = readLocal()[id]
  if (local) return { id, source: 'browser', ...local }
  if (await hasServer()) {
    const r = await fetch(`${API}/decks/${id}`)
    if (r.ok) return { id, source: 'file', updated: new Date().toISOString(), deck: await r.json() }
  }
  if (id === EXAMPLE_ID) return { id, source: 'example', updated: '', deck: example }
  return null
}

// Saves to the deck's own place; the read-only example (without a server) is copied into the browser.
export async function saveDeck(id: string, source: DeckSource, deck: unknown): Promise<DeckSource> {
  const updated = new Date().toISOString()
  if (source !== 'browser' && (await hasServer())) {
    const r = await fetch(`${API}/decks/${id}`, { method: 'PUT', body: JSON.stringify(deck) })
    if (!r.ok) throw new Error('Could not save the deck file.')
    return 'file'
  }
  writeLocal({ ...readLocal(), [id]: { deck, updated } })
  return 'browser'
}

export async function createDeck(baseId: string, deck: unknown): Promise<string> {
  const taken = new Set((await listDecks()).map((d) => d.id))
  let id = baseId
  for (let n = 2; taken.has(id); n++) id = `${baseId}-${n}`
  await saveDeck(id, (await hasServer()) ? 'file' : 'browser', deck)
  return id
}

export async function deleteDeck(id: string, source: DeckSource) {
  if (source === 'browser') {
    const store = readLocal()
    delete store[id]
    writeLocal(store)
  } else if (source === 'file') {
    await fetch(`${API}/decks/${id}`, { method: 'DELETE' })
  }
}

// Live updates from the local server (a coding agent or the CLI changed a deck file).
export function onDeckChange(handler: (id: string) => void): () => void {
  let source: EventSource | null = null
  void hasServer().then((ok) => {
    if (!ok) return
    source = new EventSource(`${API}/events`)
    source.addEventListener('deck', (e) => handler((JSON.parse((e as MessageEvent).data) as { name: string }).name))
  })
  return () => source?.close()
}
