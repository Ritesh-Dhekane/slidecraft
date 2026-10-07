// Local server for the UI: deck files over HTTP and a live-update stream (Server-Sent Events) so a
// deck edited by a coding agent or the CLI refreshes in the browser right away.
import { watch } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { DECKS_DIR, deleteDeck, listDecks, readDeck, writeDeck } from './decks.ts'

const PORT = Number(process.env.SLIDECRAFT_PORT ?? 5175)
const clients = new Set<ServerResponse>()

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  let body = ''
  for await (const chunk of req) body += chunk
  return JSON.parse(body)
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const deck = url.pathname.match(/^\/api\/decks\/([^/]+)$/)?.[1]
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, decksDir: DECKS_DIR })
  if (url.pathname === '/api/decks' && req.method === 'GET') return send(res, 200, await listDecks())
  if (deck && req.method === 'GET') return send(res, 200, await readDeck(deck))
  if (deck && req.method === 'PUT') {
    await writeDeck(deck, await readBody(req))
    return send(res, 200, { saved: deck })
  }
  if (deck && req.method === 'DELETE') {
    await deleteDeck(deck)
    return send(res, 200, { deleted: deck })
  }
  if (url.pathname === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    res.write(': connected\n\n')
    clients.add(res)
    req.on('close', () => clients.delete(res))
    return
  }
  send(res, 404, { error: 'not_found' })
}

await mkdir(DECKS_DIR, { recursive: true })

// Editors often write a file in several steps; wait a moment and send one event per deck.
const pending = new Map<string, NodeJS.Timeout>()
watch(DECKS_DIR, (_event, file) => {
  if (!file?.endsWith('.json')) return
  const name = file.slice(0, -5)
  clearTimeout(pending.get(name))
  pending.set(
    name,
    setTimeout(() => {
      pending.delete(name)
      for (const client of clients) client.write(`event: deck\ndata: ${JSON.stringify({ name })}\n\n`)
    }, 150),
  )
})

createServer((req, res) => {
  handle(req, res).catch((err: Error) => send(res, err.message.includes('ENOENT') ? 404 : 400, { error: err.message }))
}).listen(PORT, () => console.log(`slidecraft server on http://localhost:${PORT} (decks: ${DECKS_DIR})`))
