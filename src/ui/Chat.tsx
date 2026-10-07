// AI chat panel. The Gemini-powered version arrives in TASK-007.
import { Sparkles } from 'lucide-react'
import type { RawDeck } from './Editor.tsx'

export function Chat(_props: { deckId: string; raw: RawDeck; selected: number; onApply: (next: RawDeck) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-ink-2">
      <Sparkles className="size-6 text-ai" aria-hidden="true" />
      <p className="font-medium text-ink">AI chat is coming next</p>
      <p className="text-sm">Edit slides with the form for now, or ask your coding agent.</p>
    </div>
  )
}
