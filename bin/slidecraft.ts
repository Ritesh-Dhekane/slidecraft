#!/usr/bin/env -S npx tsx
// slidecraft CLI. `list` works now; `new`, `check` and `export` arrive with the schema (TASK-002/004/005).
import { listDecks } from '../server/decks.ts'

const [command] = process.argv.slice(2)

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
  default:
    console.log('usage: slidecraft <list>\n  list   decks in ./decks, newest first')
    process.exitCode = command ? 1 : 0
}
