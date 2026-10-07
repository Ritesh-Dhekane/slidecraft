#!/usr/bin/env -S npx tsx
// slidecraft CLI: list decks and export them to .pptx. `new` and `check` come with TASK-005.
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { layoutDeck } from '../src/layout/layout.ts'
import { pptxBytes } from '../src/render/pptx/exportPptx.ts'
import { parseDeck } from '../src/schema/parse.ts'
import { deckPath, listDecks } from '../server/decks.ts'

const USAGE = `usage: slidecraft <command>
  list                          decks in ./decks, newest first
  export <deck> [--out f.pptx]  write an editable PowerPoint file (deck name or path to .json)`

const [command, arg, ...rest] = process.argv.slice(2)
const option = (name: string) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : undefined)
// A deck name from decks/ or a path to a .json file.
const resolveDeck = (a: string) => (a.endsWith('.json') ? a : deckPath(a))

switch (command) {
  case 'list': {
    const decks = await listDecks().catch(() => [])
    console.log(
      decks.length
        ? decks.map((d) => `${d.name}  (${d.updated.slice(0, 16).replace('T', ' ')})`).join('\n')
        : 'No decks yet.',
    )
    break
  }
  case 'export': {
    if (!arg) {
      console.log(USAGE)
      process.exitCode = 1
      break
    }
    const file = resolveDeck(arg)
    const parsed = parseDeck(JSON.parse(await readFile(file, 'utf8')))
    if (!parsed.ok) {
      console.log(parsed.errors.join('\n'))
      process.exitCode = 1
      break
    }
    const { deck, warnings } = layoutDeck(parsed.deck)
    for (const w of warnings) console.log(`warning: slide ${w.slide}: ${w.message}`)
    const out = option('--out') ?? `${basename(file, '.json')}.pptx`
    await writeFile(out, await pptxBytes(deck))
    console.log(`Wrote ${out} (${deck.slides.length} slides)`)
    break
  }
  default:
    console.log(USAGE)
    process.exitCode = command ? 1 : 0
}
