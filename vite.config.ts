import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderRootForPath, buildSitemap, buildRobots, build404, buildWebManifest, normalizePath } from './scripts/prerender'
import { buildHeadTags } from './scripts/head'
import { byPath, isSiteId, livePages, type SiteId } from './src/site/manifest'

// One repo, three sites. Each Vite run builds exactly one of them, chosen by
// the SITE env var (fire | games | tools; default fire):
//
//   root    sites/<site>/          its pages' index.html files, mirroring the URL paths
//   outDir  dist/<site>/           served as https://<site>.chraegames.cloud
//
// `npm run build` runs all three (+ copies the apex storage bridge to dist/legacy).
const SITE: SiteId = (() => {
  const raw = process.env.SITE ?? 'fire'
  if (!isSiteId(raw)) throw new Error(`SITE must be fire, games or tools (got "${raw}")`)
  return raw
})()

const root = resolve(__dirname, 'sites', SITE)
const outDir = resolve(__dirname, 'dist', SITE)

// Everything page-shaped derives from src/site/manifest.ts:
//   - build inputs: one sites/<site>/<path>/index.html per live page of the site
//   - transformIndexHtml: inject <head> tags (title/canonical/OG/JSON-LD) in dev
//     and build, plus the prerendered markup into <div id="root"> at build time
//     (replaced on mount by createRoot — never hydrated)
//   - closeBundle: emit the site's sitemap.xml, robots.txt, 404.html, its share
//     image (sites/<site>/og.png → /og.png) and, for fire, the web manifest
function sitePages(): Plugin {
  return {
    name: 'site-pages',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const entry = byPath(SITE, normalizePath(ctx.path))
        if (!entry) return html
        const tags = buildHeadTags(entry)
        if (ctx.server) return { html, tags }
        const markup = renderRootForPath(SITE, ctx.path)
        if (!markup) return { html, tags }
        const slot = '<div id="root"></div>'
        if (!html.includes(slot)) {
          throw new Error(`${ctx.path}: expected the literal ${slot} for prerender injection`)
        }
        return { html: html.replace(slot, `<div id="root">${markup}</div>`), tags }
      },
    },
    closeBundle() {
      writeFileSync(resolve(outDir, 'sitemap.xml'), buildSitemap(SITE))
      writeFileSync(resolve(outDir, 'robots.txt'), buildRobots(SITE))
      writeFileSync(resolve(outDir, '404.html'), build404(SITE))
      copyFileSync(resolve(root, 'og.png'), resolve(outDir, 'og.png'))
      if (SITE === 'fire') writeFileSync(resolve(outDir, 'manifest.webmanifest'), buildWebManifest())
    },
  }
}

const input = Object.fromEntries(
  livePages(SITE).map(p => [p.slug.replace(/\//g, '_'), resolve(root, p.path.slice(1), 'index.html')]),
)

export default defineConfig({
  root,
  publicDir: resolve(__dirname, 'public'),
  envDir: __dirname,
  // The per-page index.html files keep root-absolute script URLs (/src/main.tsx);
  // the source tree lives at the repo root, not under sites/<site>/.
  resolve: { alias: [{ find: /^\/src\//, replacement: `${resolve(__dirname, 'src')}/` }] },
  plugins: [react(), sitePages()],
  build: { outDir, emptyOutDir: true, rollupOptions: { input } },
  server: { fs: { allow: [__dirname] } },
})
