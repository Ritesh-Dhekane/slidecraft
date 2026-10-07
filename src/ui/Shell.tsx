// App frame from the Stitch design: left sidebar (logo, search, navigation, usage) and a top bar with
// breadcrumb, token counter, theme toggle and settings.
import { LayoutGrid, Menu, Moon, PenLine, Search, Settings, Sparkles, Sun, X, Zap } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { openSettings } from './events.ts'
import { formatTokens, setPrefs, usePrefs } from './prefs.ts'
import { deckHref, navigate } from './router.ts'

export function Logo() {
  return (
    <a href="#/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
      <Sparkles className="size-5 text-ai" aria-hidden="true" /> slidecraft
    </a>
  )
}

export function ThemeToggle() {
  const { appearance } = usePrefs()
  const dark = document.documentElement.dataset.theme === 'dark'
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={label}
      title={label}
      onClick={() => setPrefs({ appearance: dark ? 'light' : 'dark' })}
      data-appearance={appearance}
    >
      {dark ? <Sun className="size-[18px]" aria-hidden="true" /> : <Moon className="size-[18px]" aria-hidden="true" />}
    </button>
  )
}

function Sidebar({ query, onQuery, lastDeck, onClose }: SidebarProps) {
  const { usage } = usePrefs()
  const tokens = usage.reduce((n, u) => n + u.input + u.output, 0)
  const nav = [
    { href: '#/', label: 'My decks', icon: LayoutGrid, active: !location.hash.startsWith('#/deck') },
    ...(lastDeck
      ? [{ href: deckHref(lastDeck), label: 'Editor', icon: PenLine, active: location.hash.startsWith('#/deck') }]
      : []),
  ]
  return (
    <aside className="flex h-full w-60 flex-col gap-4 border-r border-line bg-rail p-4">
      <div className="flex items-center justify-between">
        <Logo />
        {onClose && (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close menu">
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <label className="relative block">
        <span className="sr-only">Search decks</span>
        <Search className="absolute top-2.5 left-2.5 size-4 text-ink-3" aria-hidden="true" />
        <input
          className="field pl-8"
          placeholder="Search decks…"
          value={query}
          onChange={(e) => {
            onQuery(e.target.value)
            if (location.hash.startsWith('#/deck')) navigate('/')
          }}
        />
      </label>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {nav.map((n) => (
          <a
            key={n.label}
            href={n.href}
            aria-current={n.active ? 'page' : undefined}
            className={`flex h-9 items-center gap-2.5 rounded px-2.5 text-sm font-medium ${
              n.active ? 'bg-primary text-on-primary' : 'text-ink-2 hover:bg-surface hover:text-ink'
            }`}
          >
            <n.icon className="size-4" aria-hidden="true" /> {n.label}
          </a>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-3">
        <div className="panel p-3">
          <p className="label-code">AI usage (this browser)</p>
          <p className="mt-1 font-mono text-sm text-ink">{formatTokens(tokens)} tokens</p>
        </div>
        <button
          type="button"
          onClick={openSettings}
          className="flex h-9 items-center gap-2.5 rounded px-2.5 text-sm text-ink-2 hover:bg-surface hover:text-ink"
        >
          <Settings className="size-4" aria-hidden="true" /> Settings
        </button>
      </div>
    </aside>
  )
}

type SidebarProps = { query: string; onQuery: (q: string) => void; lastDeck: string | null; onClose?: () => void }

export function Shell({ crumb, children, ...sidebar }: SidebarProps & { crumb: ReactNode; children: ReactNode }) {
  const { usage } = usePrefs()
  const [menu, setMenu] = useState(false)
  const tokens = usage.reduce((n, u) => n + u.input + u.output, 0)
  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="hidden lg:block">
        <Sidebar {...sidebar} />
      </div>
      {menu && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMenu(false)}
          />
          <div className="relative h-full w-60">
            <Sidebar {...sidebar} onClose={() => setMenu(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 lg:px-5">
          <button type="button" className="icon-btn lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu">
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm text-ink-2">{crumb}</div>
          <span
            className="hidden items-center gap-1.5 rounded-full bg-ai-soft px-3 py-1 font-mono text-xs text-ai-ink sm:inline-flex"
            title="Gemini tokens used in this browser"
          >
            <Zap className="size-3.5" aria-hidden="true" /> {formatTokens(tokens)}
          </span>
          <ThemeToggle />
          <button type="button" onClick={openSettings} className="icon-btn" aria-label="Settings">
            <Settings className="size-[18px]" aria-hidden="true" />
          </button>
        </header>
        <main id="main" className="min-h-0 flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
