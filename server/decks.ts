// The decks folder: one JSON file per deck (decks/<name>.json), written by coding agents, the CLI or the UI.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export const DECKS_DIR = resolve(process.env.SLIDECRAFT_DECKS ?? 'decks')
const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/

export function deckPath(name: string): string {
  if (!NAME.test(name)) throw new Error(`Deck names use lowercase letters, digits and dashes: "${name}"`)
  return join(DECKS_DIR, `${name}.json`)
}

export async function listDecks(): Promise<{ name: string; updated: string }[]> {
  const files = (await readdir(DECKS_DIR)).filter((f) => f.endsWith('.json'))
  const decks = await Promise.all(
    files.map(async (f) => ({ name: f.slice(0, -5), updated: (await stat(join(DECKS_DIR, f))).mtime.toISOString() })),
  )
  return decks.sort((a, b) => b.updated.localeCompare(a.updated))
}

export async function readDeck(name: string): Promise<unknown> {
  return JSON.parse(await readFile(deckPath(name), 'utf8'))
}

export async function writeDeck(name: string, deck: unknown): Promise<void> {
  await writeFile(deckPath(name), JSON.stringify(deck, null, 2) + '\n')
}
