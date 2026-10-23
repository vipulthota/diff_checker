import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Strict Content-Security-Policy for production builds. It works on every static host
// (even ones that cannot set headers) and blocks inline scripts, remote scripts and
// any network request to another origin, which backs up the "nothing leaves your browser" promise.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function csp(): Plugin {
  return {
    name: 'diffspace-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<!--csp-->', `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  }
}

function devNoCsp(): Plugin {
  return {
    name: 'diffspace-dev-no-csp',
    apply: 'serve',
    transformIndexHtml: (html) => html.replace('<!--csp-->', ''),
  }
}

// base './' keeps every asset path relative so the build works on GitHub Pages
// sub-paths, Netlify, Cloudflare Pages, Vercel and custom domains alike.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), csp(), devNoCsp()],
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
