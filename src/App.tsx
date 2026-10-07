// Temporary shell: lists the decks the local server sees and refreshes when a deck file changes.
// The real editor UI is built from the Stitch design in TASK-006.
import { useEffect, useState } from 'react'

type DeckInfo = { name: string; updated: string }

export default function App() {
  const [decks, setDecks] = useState<DeckInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastChange, setLastChange] = useState<string | null>(null)

  useEffect(() => {
    const load = () =>
      fetch('/api/decks')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`server answered ${r.status}`))))
        .then((list: DeckInfo[]) => {
          setDecks(list)
          setError(null)
        })
        .catch((err: Error) => setError(`Local server not reachable (${err.message}). Run npm run dev.`))
    load()
    const events = new EventSource('/api/events')
    events.addEventListener('deck', (e) => {
      setLastChange((JSON.parse((e as MessageEvent).data) as { name: string }).name)
      load()
    })
    return () => events.close()
  }, [])

  return (
    <main className="mx-auto max-w-2xl p-8 font-sans text-slate-800">
      <h1 className="text-2xl font-semibold">slidecraft</h1>
      <p className="mt-1 text-slate-500">
        Decks in the local <code>decks/</code> folder update here live.
      </p>
      {error && <p className="mt-6 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {lastChange && <p className="mt-4 text-sm text-indigo-600">Updated: {lastChange}</p>}
      <ul className="mt-6 divide-y rounded-lg border">
        {decks?.length === 0 && <li className="p-3 text-slate-500">No decks yet.</li>}
        {decks?.map((d) => (
          <li key={d.name} className="flex justify-between p-3">
            <span>{d.name}</span>
            <span className="text-sm text-slate-500">{new Date(d.updated).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
