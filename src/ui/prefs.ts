// Settings kept in this browser: the app's light/dark theme, the user's own Gemini key and model, and
// a log of AI token usage. The key never goes to our server — only from this browser to Google.
import { useSyncExternalStore } from 'react'

export type UsageEntry = { at: string; deck?: string; model: string; input: number; output: number }

export type Prefs = {
  appearance: 'light' | 'dark' | 'system'
  geminiKey: string
  geminiModel: string
  // USD per million tokens, editable in Settings (prices change; these are only estimates).
  prices: Record<string, { input: number; output: number }>
  usage: UsageEntry[]
}

const KEY = 'slidecraft.prefs'

export const DEFAULT_PRICES: Prefs['prices'] = {
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
}

const DEFAULTS: Prefs = {
  appearance: 'system',
  geminiKey: '',
  geminiModel: 'gemini-2.5-flash',
  prices: DEFAULT_PRICES,
  usage: [],
}

function read(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>) }
  } catch {
    return DEFAULTS
  }
}

let current = read()
const listeners = new Set<() => void>()

export function getPrefs() {
  return current
}

export function setPrefs(patch: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>)) {
  current = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // storage blocked: keep for this visit
  }
  applyAppearance()
  listeners.forEach((l) => l())
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getPrefs,
    getPrefs,
  )
}

export function applyAppearance() {
  const dark =
    current.appearance === 'dark' ||
    (current.appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function costOf(entries: UsageEntry[], prices = current.prices): number {
  return entries.reduce((sum, e) => {
    const p = prices[e.model] ?? { input: 0, output: 0 }
    return sum + (e.input * p.input + e.output * p.output) / 1e6
  }, 0)
}

export const formatTokens = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString())
export const formatCost = (usd: number) => (usd === 0 ? '$0' : usd < 0.01 ? '<$0.01' : `~$${usd.toFixed(2)}`)
