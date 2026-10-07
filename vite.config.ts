import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The UI runs on 5173 and proxies /api to the local server (server/index.ts) on 5175.
// BASE_PATH is set by the GitHub Pages workflow (the site lives under /slidecraft/).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://localhost:5175' } },
})
