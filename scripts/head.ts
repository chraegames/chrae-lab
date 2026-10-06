// Build-time <head> generation. Every page's title / description / canonical /
// OG / Twitter / JSON-LD tags are derived from the site manifest so the per-page
// index.html files only carry the handful of lines that genuinely differ.
// Consumed by the sitePages() plugin in vite.config.ts (Node context).

import {
  absoluteUrl,
  breadcrumbs,
  liveTools,
  siteHome,
  siteOf,
  siteUrl,
  type SiteEntry,
} from '../src/site/manifest';
import { THEME_KEY } from '../src/utils/persistence';

/** Structurally compatible with Vite's HtmlTagDescriptor. */
export interface HeadTag {
  tag: string;
  attrs?: Record<string, string>;
  children?: string;
  injectTo?: 'head' | 'head-prepend' | 'body' | 'body-prepend';
}

/**
 * Runs before any CSS so the first paint matches the stored theme: stored
 * preference wins, then the OS preference. Must stay in lockstep with
 * useTheme.readInitial().
 */
export const THEME_BOOT_SCRIPT =
  `try{var t=localStorage.getItem('${THEME_KEY}');` +
  `if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))` +
  `document.documentElement.setAttribute('data-theme','dark')}catch(e){}`;

/** Pre-CSS page background so neither theme flashes white/black before tokens.css loads. Must equal --bg in tokens.css. */
export const ANTI_FLASH_STYLE =
  'html{margin:0;background:#FAF9F6}html[data-theme=dark]{background:#0F1113}body{margin:0}';

function meta(attr: 'name' | 'property', key: string, content: string): HeadTag {
  return { tag: 'meta', attrs: { [attr]: key, content }, injectTo: 'head' };
}

function jsonLd(data: object): HeadTag {
  return {
    tag: 'script',
    attrs: { type: 'application/ld+json' },
    children: JSON.stringify(data),
    injectTo: 'head',
  };
}

function breadcrumbList(entry: SiteEntry): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs(entry).map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb),
    })),
  };
}

/** WebApplication + FAQPage for a tool, derived from its `about` copy so markup and schema never drift. */
function toolJsonLd(entry: SiteEntry): object[] {
  if (!entry.about) return [];
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: entry.name,
      url: absoluteUrl(entry),
      applicationCategory: entry.about.applicationCategory,
      operatingSystem: 'Any (web browser)',
      browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: entry.description,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: entry.about.faq.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ];
}

/** The landing's own apps (never the other sites'). */
function toolItemList(entry: SiteEntry): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: entry.site === 'games' ? `${siteOf(entry).name} games` : `${siteOf(entry).name}`,
    itemListElement: liveTools(entry.site).map((tool, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: tool.name,
      url: absoluteUrl(tool),
    })),
  };
}

export function buildHeadTags(entry: SiteEntry): HeadTag[] {
  const url = absoluteUrl(entry);
  const image = siteUrl(entry.site, '/og.png');
  const tags: HeadTag[] = [
    { tag: 'script', children: THEME_BOOT_SCRIPT, injectTo: 'head-prepend' },
    { tag: 'title', children: entry.title, injectTo: 'head' },
    meta('name', 'description', entry.description),
    { tag: 'link', attrs: { rel: 'canonical', href: url }, injectTo: 'head' },
    meta('property', 'og:type', entry.ogType ?? 'website'),
    meta('property', 'og:site_name', siteOf(entry).name),
    meta('property', 'og:url', url),
    meta('property', 'og:title', entry.title),
    meta('property', 'og:description', entry.description),
    meta('property', 'og:image', image),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('property', 'og:image:alt', `${siteOf(entry).name} — ${siteHome(entry.site).tagline}`),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', entry.title),
    meta('name', 'twitter:description', entry.description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', `${siteOf(entry).name} — ${siteHome(entry.site).tagline}`),
    meta('name', 'robots', 'index, follow'),
    { tag: 'style', children: ANTI_FLASH_STYLE, injectTo: 'head' },
  ];
  for (const [name, content] of Object.entries(entry.verification ?? {})) {
    tags.push(meta('name', name, content));
  }
  // A one-item trail (a site home) is not a breadcrumb.
  if (breadcrumbs(entry).length > 1) tags.push(jsonLd(breadcrumbList(entry)));
  if (entry.kind === 'hub') tags.push(jsonLd(toolItemList(entry)));
  if (entry.kind === 'app') for (const block of toolJsonLd(entry)) tags.push(jsonLd(block));
  for (const block of entry.jsonLd ?? []) tags.push(jsonLd(block));
  return tags;
}
