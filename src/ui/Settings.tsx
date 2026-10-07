// Settings dialog: appearance, AI provider (the user's own Gemini key, stored only in this browser),
// usage, and how to use a coding agent instead.
import { Bot, Eye, EyeOff, KeyRound, Palette, Terminal, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { costOf, DEFAULT_PRICES, formatCost, formatTokens, setPrefs, usePrefs } from './prefs.ts'

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line pb-5 last:border-0">
      <h3 className="flex items-center gap-2 font-semibold">
        {icon} {title}
      </h3>
      {children}
    </section>
  )
}

export function Settings({ onClose, extra }: { onClose: () => void; extra?: ReactNode }) {
  const prefs = usePrefs()
  const ref = useRef<HTMLDialogElement>(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const month = today.slice(0, 7)
  const sum = (list: typeof prefs.usage) => ({
    tokens: list.reduce((n, u) => n + u.input + u.output, 0),
    cost: costOf(list),
  })
  const rows = [
    ['Today', sum(prefs.usage.filter((u) => u.at.startsWith(today)))],
    ['This month', sum(prefs.usage.filter((u) => u.at.startsWith(month)))],
    ['All time', sum(prefs.usage)],
  ] as const

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="settings-h"
      className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-xl border border-line-strong bg-surface p-0 text-ink shadow-[0_16px_36px_rgba(15,23,42,0.12)] backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 id="settings-h" className="text-lg font-semibold">
          Settings
        </h2>
        <button type="button" className="icon-btn" aria-label="Close settings" onClick={() => ref.current?.close()}>
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex max-h-[75dvh] flex-col gap-5 overflow-auto p-5">
        <Section icon={<KeyRound className="size-4 text-ai" aria-hidden="true" />} title="AI provider">
          <div className="flex flex-wrap gap-2">
            <span className="rounded border border-primary bg-primary px-2.5 py-1 text-sm text-on-primary">Gemini</span>
            <span className="rounded border border-line px-2.5 py-1 text-sm text-ink-3">OpenAI · coming soon</span>
            <span className="rounded border border-line px-2.5 py-1 text-sm text-ink-3">Anthropic · coming soon</span>
          </div>
          <label className="flex flex-col gap-1">
            <span className="label-code">Gemini API key</span>
            <span className="flex gap-2">
              <input
                className="field font-mono"
                type={show ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                placeholder="AIza…"
                value={prefs.geminiKey}
                onChange={(e) => setPrefs({ geminiKey: e.target.value.trim() })}
              />
              <button
                type="button"
                className="icon-btn shrink-0"
                aria-label={show ? 'Hide key' : 'Show key'}
                onClick={() => setShow(!show)}
              >
                {show ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </span>
          </label>
          {extra}
          <p className="text-sm text-ink-2">
            Your key is stored only in this browser and sent only to Google. Get one free at{' '}
            <a
              className="text-primary-ink underline"
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
            >
              Google AI Studio
            </a>
            .
          </p>
          <label className="flex flex-col gap-1">
            <span className="label-code">Model</span>
            <select
              className="field"
              value={prefs.geminiModel}
              onChange={(e) => setPrefs({ geminiModel: e.target.value })}
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash — fast, good quality (recommended)</option>
              <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite — cheapest, simpler decks</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro — best writing, slower and pricier</option>
            </select>
          </label>
        </Section>

        <Section icon={<Bot className="size-4 text-ai" aria-hidden="true" />} title="Usage">
          <table className="w-full text-sm">
            <tbody>
              {rows.map(([label, v]) => (
                <tr key={label} className="border-b border-line last:border-0">
                  <th scope="row" className="py-1.5 text-left font-normal text-ink-2">
                    {label}
                  </th>
                  <td className="py-1.5 text-right font-mono">{formatTokens(v.tokens)} tokens</td>
                  <td className="py-1.5 text-right font-mono">{formatCost(v.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <details className="text-sm">
            <summary className="cursor-pointer text-ink-2">Prices used for estimates (USD per million tokens)</summary>
            <div className="mt-2 flex flex-col gap-2">
              {Object.entries(prefs.prices).map(([model, p]) => (
                <div key={model} className="grid grid-cols-[1fr_6rem_6rem] items-center gap-2">
                  <span className="font-mono text-xs">{model}</span>
                  {(['input', 'output'] as const).map((k) => (
                    <label key={k}>
                      <span className="sr-only">
                        {model} {k} price
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="field h-8 font-mono"
                        value={p[k]}
                        onChange={(e) =>
                          setPrefs((all) => ({
                            prices: { ...all.prices, [model]: { ...all.prices[model], [k]: Number(e.target.value) } },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              ))}
              <button type="button" className="chip self-start" onClick={() => setPrefs({ prices: DEFAULT_PRICES })}>
                Reset prices
              </button>
            </div>
          </details>
          {prefs.usage.length > 0 && (
            <button
              type="button"
              className="chip self-start"
              onClick={() => confirm('Clear the usage history?') && setPrefs({ usage: [] })}
            >
              Clear usage history
            </button>
          )}
        </Section>

        <Section icon={<Palette className="size-4 text-ai" aria-hidden="true" />} title="Appearance">
          <div className="flex gap-2" role="radiogroup" aria-label="Appearance">
            {(['light', 'dark', 'system'] as const).map((a) => (
              <label
                key={a}
                className={`chip cursor-pointer has-[:checked]:border-primary has-[:checked]:text-primary-ink`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name="appearance"
                  checked={prefs.appearance === a}
                  onChange={() => setPrefs({ appearance: a })}
                />
                {a[0].toUpperCase() + a.slice(1)}
              </label>
            ))}
          </div>
        </Section>

        <Section icon={<Terminal className="size-4 text-ai" aria-hidden="true" />} title="Coding agent">
          <p className="text-sm text-ink-2">
            Run <code className="font-mono">npm run dev</code> in the project folder and ask Claude Code, Codex or
            Antigravity for a deck. Agents follow <code className="font-mono">AGENTS.md</code>, write{' '}
            <code className="font-mono">decks/&lt;name&gt;.json</code>, and check it with{' '}
            <code className="font-mono">npm run slidecraft -- check &lt;name&gt;</code>. Changes appear here live.
          </p>
        </Section>
      </div>
    </dialog>
  )
}
