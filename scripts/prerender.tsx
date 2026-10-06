// Build-time prerendering for SEO. Renders each page's pure component to a
// static HTML string so crawlers and no-JS visitors get real content on the
// first byte. Used by the sitePages() plugin in vite.config.ts.
//
// PURE Node context: only imports component trees that are themselves free of
// hooks/CSS imports/browser APIs (see src/site/prerenderPages.tsx), plus
// react-dom/server. Do not import the app shell here.

import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { PRERENDER_PAGES } from '../src/site/prerenderPages';
import { BRAND_NAME, SITES, absoluteUrl, hrefFor, liveTools, livePages, otherSites, siteHome, type SiteId } from '../src/site/manifest';

/** Normalize a transformIndexHtml ctx.path ("/fire-planner/index.html", "/index.html") to a manifest path ("/fire-planner/", "/"). */
export function normalizePath(path: string): string {
  const dir = path.replace(/index\.html$/, '');
  return dir.endsWith('/') ? dir : `${dir}/`;
}

/**
 * Returns the static markup to inject into a page's #root, or '' when the path
 * isn't a known prerender target (the plugin then leaves the HTML untouched).
 */
export function renderRootForPath(site: SiteId, path: string): string {
  const key = normalizePath(path);
  const page = PRERENDER_PAGES.find(p => p.entry.site === site && p.entry.path === key);
  if (!page) return '';
  return renderToStaticMarkup(createElement(page.Component));
}

const PRIORITY = { hub: '1.0', app: '0.9', content: '0.8' } as const;

/** A site's sitemap.xml: every live page of that site; <lastmod> is the entry's `updated` date, else the build date. */
export function buildSitemap(site: SiteId, lastmod = new Date().toISOString().slice(0, 10)): string {
  const urls = livePages(site)
    .map(p =>
      [
        '  <url>',
        `    <loc>${absoluteUrl(p)}</loc>`,
        `    <lastmod>${p.updated ?? lastmod}</lastmod>`,
        `    <priority>${p.path === '/' ? '1.0' : PRIORITY[p.kind]}</priority>`,
        '  </url>',
      ].join('\n'),
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function buildRobots(site: SiteId): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITES[site].origin}/sitemap.xml\n`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Standalone 404 page (no app bundle): links to this site's pages first, then the other two sites. */
export function build404(site: SiteId): string {
  const home = siteHome(site);
  const links = [
    { href: '/', label: SITES[site].homeLabel },
    ...liveTools(site)
      .filter(t => t !== home)
      .slice(0, 5)
      .map(t => ({ href: t.path, label: t.name })),
    ...otherSites(site).map(s => ({ href: hrefFor(s, site), label: s.name })),
  ];
  const items = links.map(l => `        <li><a href="${l.href}">${escapeHtml(l.label)}</a></li>`).join('\n');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>Page not found — ${escapeHtml(SITES[site].name)}</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: 'Space Grotesk', system-ui, sans-serif; background: #FAF9F6; color: #14171A; }
      @media (prefers-color-scheme: dark) { body { background: #0F1113; color: #EDEAE3; } a { color: #5BD3C0; } }
      main { max-width: 480px; padding: 32px; text-align: center; }
      p.mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.6; }
      h1 { font-weight: 500; font-size: 28px; margin: 8px 0 12px; }
      a { color: #0E8577; }
      ul { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 16px; justify-content: center; font-size: 14px; }
    </style>
  </head>
  <body>
    <main>
      <p class="mono">404</p>
      <h1>That page isn't here.</h1>
      <p>${escapeHtml(SITES[site].name)} is part of ${BRAND_NAME}: small, free things that run in your browser. Try one of these:</p>
      <ul>
${items}
      </ul>
    </main>
  </body>
</html>
`;
}

/** The FIRE planner is installable; its web manifest lives at the site root. */
export function buildWebManifest(): string {
  return `${JSON.stringify(
    {
      name: 'FIRE Planner',
      short_name: 'FIRE Planner',
      description: 'Free retirement and long-term financial projection tool.',
      id: '/',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#FAF9F6',
      theme_color: '#FAF9F6',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  )}\n`;
}

/** robots.txt for the bare apex: everything there is a 301, so let crawlers in to see them. */
export const LEGACY_ROBOTS = `User-agent: *\nAllow: /\n`;
