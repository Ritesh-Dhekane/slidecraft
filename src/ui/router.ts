// Hash routes, so the app works as plain static files (GitHub Pages) too: #/ and #/deck/<id>.
import { useSyncExternalStore } from 'react'

export type Route = { name: 'home' } | { name: 'deck'; id: string }

function parse(): Route {
  const m = location.hash.match(/^#\/deck\/([^/?#]+)/)
  return m ? { name: 'deck', id: decodeURIComponent(m[1]) } : { name: 'home' }
}

let route = parse()
const listeners = new Set<() => void>()
window.addEventListener('hashchange', () => {
  route = parse()
  listeners.forEach((l) => l())
})

export const navigate = (to: string) => {
  location.hash = to
}
export const deckHref = (id: string) => `#/deck/${encodeURIComponent(id)}`

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => route,
  )
}
