import { describe, it, expect } from 'vitest';
import { renderRootForPath, buildSitemap, buildRobots, build404, buildWebManifest, normalizePath } from '../../scripts/prerender';
import { CONTENT_ROUTES, FIRE_HOME_PATH } from './routeMeta';
import { CATEGORIES, PAGES, SITES, SITE_IDS, SITE_REPO, bySlug, contentPages, livePages, liveTools, siteHome } from '../site/manifest';
import { ATTRIBUTES, BRANDS, GUIDE_REVIEWED, TECHNOLOGIES } from '../tools/tv-guide/data';
import { GUIDE_PAGES } from '../tools/tv-guide/pages';

describe('normalizePath', () => {
  it('maps dev and build ctx.path forms to manifest paths', () => {
    expect(normalizePath('/index.html')).toBe('/');
    expect(normalizePath('/fire-planner/index.html')).toBe('/fire-planner/');
    expect(normalizePath('fire-planner/how-it-works/index.html')).toBe('fire-planner/how-it-works/');
  });
});

describe('renderRootForPath', () => {
  it('prerenders each landing with its own categories and tools only', () => {
    const games = renderRootForPath('games', '/index.html');
    // the closing clause of the tagline is wrapped in <em>, so compare text-only
    expect(games.replace(/<[^>]+>/g, '')).toContain(siteHome('games').tagline);
    for (const p of liveTools('games')) expect(games).toContain(`href="${p.path}"`);
    for (let i = 1; i <= liveTools('games').length; i++) expect(games).toContain(`>${String(i).padStart(2, '0')}<`);
    for (const p of liveTools('tools')) expect(games).not.toContain(`href="${p.path}"`);
    expect(games).not.toContain('id="guides"'); // no guides on the games site
    expect(games).not.toContain('Coming soon');
    expect(games).toContain('Chrae Games is a shelf of free browser games');

    const tools = renderRootForPath('tools', '/index.html');
    expect(tools.replace(/<[^>]+>/g, '')).toContain(siteHome('tools').tagline);
    const toolCats = CATEGORIES.filter(c => liveTools('tools').some(t => t.category === c.id));
    expect(toolCats.map(c => c.id)).toEqual(['utilities', 'productivity']);
    for (const c of toolCats) expect(tools).toContain(`href="#${c.id}"`);
    for (const p of liveTools('tools')) expect(tools).toContain(`href="${p.path}"`);
    // TV guide chapters live in the Guides band
    expect(tools).toContain('id="guides"');
    expect(tools.indexOf('href="/tv-guide/technologies/"')).toBeGreaterThan(tools.indexOf('Guides'));
    expect(tools).toContain('collection of free online tools');
  });

  it('each landing links the other two sites by absolute URL', () => {
    for (const site of ['games', 'tools'] as const) {
      const html = renderRootForPath(site, '/index.html');
      expect(html).toContain('id="more"');
      for (const other of SITE_IDS.filter(s => s !== site)) expect(html, site).toContain(`href="${SITES[other].origin}/"`);
      expect(html).not.toContain(`href="${SITES[site].origin}/"`);
    }
  });

  it('every prerendered page links to the public source repository', () => {
    for (const p of livePages()) {
      expect(renderRootForPath(p.site, `${p.path}index.html`), p.slug).toContain(`href="${SITE_REPO}"`);
    }
  });

  it('nothing prerendered links to the bare apex, the old fireplan host or a /fire-planner/ path', () => {
    for (const p of livePages()) {
      const html = renderRootForPath(p.site, `${p.path}index.html`);
      expect(html, p.slug).not.toMatch(/href="https:\/\/(www\.)?chraegames\.cloud/);
      expect(html, p.slug).not.toContain('fireplan.');
      expect(html, p.slug).not.toContain('href="/fire-planner/');
    }
  });

  it('prerenders tool pages with About, FAQ text, same-site siblings and the other sites', () => {
    const entry = bySlug('sudoku');
    const html = renderRootForPath('games', '/sudoku/index.html');
    expect(html).toContain('About Sudoku');
    for (const f of entry.about!.faq) expect(html).toContain(f.q);
    expect(html).toContain('href="/bingo/"');
    expect(html).not.toContain('href="/calculator/"');
    expect(html).toContain('href="/"');
    expect(html).toContain('All games');
    expect(html).toContain(`href="${SITES.tools.origin}/"`);
    expect(html).toContain(`href="${SITES.fire.origin}/"`);
    expect(html).not.toContain('href="/sudoku/"');
  });

  it('prerenders Magic Tower with its About copy and a games sibling', () => {
    const html = renderRootForPath('games', '/magic-tower/index.html');
    expect(html).toContain('About Magic Tower');
    expect(html).toContain('魔塔');
    expect(html).toContain('href="/sudoku/"');
    expect(html).not.toContain('href="/magic-tower/"');
  });

  it('prerenders the calculator with a same-category sibling first', () => {
    const html = renderRootForPath('tools', '/calculator/index.html');
    expect(html).toContain('About Calculator');
    expect(html.indexOf('href="/unit-converter/"')).toBeLessThan(html.indexOf('href="/todo/"'));
    expect(html).not.toContain('href="/calculator/"');
    expect(html).toContain('All tools');
  });

  it('prerenders the FIRE hero + all three "what this is" sections at the fire root', () => {
    const html = renderRootForPath('fire', '/index.html');
    expect(html).toContain('Plan your retirement');
    expect(html).toContain('Runs on this device');
    expect(html).toContain('What you can do');
    expect(html).toContain('How it works');
    expect(html).toContain('Your data');
    expect(renderRootForPath('games', '/index.html')).not.toContain('Plan your retirement');
  });

  it('prerenders each content route with its heading', () => {
    expect(renderRootForPath('fire', '/coast-fire-calculator/index.html')).toContain('Coast FIRE calculator');
    expect(renderRootForPath('fire', '/4-percent-rule/index.html')).toContain('4% rule');
    expect(renderRootForPath('fire', '/retirement-withdrawal-strategy/index.html')).toContain('withdrawal strategy');
    expect(renderRootForPath('fire', '/how-it-works/index.html')).toContain('How FIRE Planner works');
  });

  it('content pages cross-link siblings (not themselves) and crumb back to the planner', () => {
    const html = renderRootForPath('fire', '/coast-fire-calculator/index.html');
    expect(FIRE_HOME_PATH).toBe('/');
    expect(html).toContain('href="/4-percent-rule/"');
    expect(html).not.toContain('href="/coast-fire-calculator/"');
    expect(html).toContain('href="/"');
    for (const r of CONTENT_ROUTES) expect(r.path).toBe(`/${r.slug}/`);
  });

  it('prerenders the TV guide overview with the chooser fallback, chapters, changelog and About copy', () => {
    const entry = bySlug('tv-guide');
    const html = renderRootForPath('tools', '/tv-guide/index.html');
    expect(html).toContain('Every TV is one of two things');
    expect(html).toContain('Help me choose');
    for (const p of GUIDE_PAGES) expect(html).toContain(`href="${p.path}"`);
    expect(html).toMatch(new RegExp(`<time[^>]*datetime="${GUIDE_REVIEWED}"`, 'i'));
    expect(html).toContain('id="changelog"');
    expect(html).toContain('About TV buying guide');
    for (const f of entry.about!.faq) expect(html).toContain(f.q);
    expect(html).toContain('href="/unit-converter/"');
    expect(html).toContain('@keyframes tvg-');
    expect(html).not.toContain('import.meta');
  });

  it('prerenders every technology (with anchors, diagrams and prose) on the technologies chapter', () => {
    const html = renderRootForPath('tools', '/tv-guide/technologies/index.html');
    for (const t of TECHNOLOGIES) {
      expect(html).toContain(`id="tech-${t.id}"`);
      expect(html).toContain(`href="#tech-${t.id}"`);
      expect(html).toContain(t.name);
      for (const pro of t.pros) expect(html).toContain(pro.replace(/'/g, '&#x27;'));
    }
    expect((html.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(TECHNOLOGIES.length);
    expect(html).toContain('href="/tv-guide/"');
    expect(html).toContain('href="/"');
    // the section nav marks the current chapter rather than omitting it
    expect(html).toMatch(/href="\/tv-guide\/technologies\/" aria-current="page"/);
  });

  it('prerenders every brand name with its official link and technology chips', () => {
    const html = renderRootForPath('tools', '/tv-guide/brands/index.html');
    for (const b of BRANDS) {
      expect(html).toContain(`id="brand-${b.id}"`);
      expect(html).toContain(`href="${b.officialUrl}"`);
      for (const n of b.names) expect(html).toContain(n.name.replace(/'/g, '&#x27;'));
    }
    expect(html).toContain('rel="noopener nofollow"');
    expect(html).toContain('href="/tv-guide/technologies/#tech-mini-led"');
  });

  it('prerenders the decoder as full two-way tables and the compare page as the full matrix', () => {
    const decoder = renderRootForPath('tools', '/tv-guide/decoder/index.html');
    for (const b of BRANDS) for (const n of b.names) expect(decoder).toContain(n.name.replace(/'/g, '&#x27;'));
    expect(decoder).toContain('Every technology and its names');
    expect(decoder).not.toContain('<input');
    const compare = renderRootForPath('tools', '/tv-guide/compare/index.html');
    for (const a of ATTRIBUTES) expect(compare).toContain(a.label.replace(/&/g, '&amp;'));
    for (const t of TECHNOLOGIES) expect(compare).toContain(`>${t.shortName}<`);
    expect(compare).toContain('<table');
  });

  it('returns empty string for unknown or other-site paths (plugin leaves HTML untouched)', () => {
    expect(renderRootForPath('tools', '/does-not-exist/index.html')).toBe('');
    expect(renderRootForPath('tools', '/sudoku/index.html')).toBe('');
  });
});

describe('per-site files', () => {
  it('each sitemap lists exactly its own live pages as absolute URLs', () => {
    for (const site of SITE_IDS) {
      const xml = buildSitemap(site, '2026-01-01');
      for (const p of PAGES) {
        const loc = `<loc>${SITES[p.site].origin}${p.path}</loc>`;
        if (p.site === site && p.status === 'live') expect(xml).toContain(loc);
        else expect(xml).not.toContain(loc);
      }
      expect(xml.match(/<loc>/g)).toHaveLength(livePages(site).length);
      expect(xml).not.toContain('fireplan.chraegames.cloud');
      expect(xml).toContain('<priority>1.0</priority>');
    }
    // per-page `updated` wins over the build date
    const fire = buildSitemap('fire', '2026-01-01');
    expect(fire).toContain('<lastmod>2026-08-21</lastmod>');
    expect(fire).not.toContain('<lastmod>2026-01-01</lastmod>');
  });

  it('robots.txt points at the site\'s own sitemap', () => {
    expect(buildRobots('games')).toContain('Sitemap: https://games.chraegames.cloud/sitemap.xml');
  });

  it('404 pages are noindex and link home plus the other sites', () => {
    const html = build404('tools');
    expect(html).toContain('noindex');
    expect(html).toContain('<a href="/">All tools</a>');
    expect(html).toContain(`href="${SITES.games.origin}/"`);
    expect(html).toContain(`href="${SITES.fire.origin}/"`);
    expect(html).toContain('<title>Page not found — Chrae Tools</title>');
  });

  it('the FIRE web manifest is scoped to the fire site root', () => {
    const m = JSON.parse(buildWebManifest());
    expect(m.start_url).toBe('/');
    expect(m.scope).toBe('/');
  });

  it('contentPages are all reachable from a landing or the planner', () => {
    expect(contentPages('tools').every(p => p.area === 'tv-guide')).toBe(true);
    expect(contentPages('fire').every(p => p.area === 'fire-planner')).toBe(true);
  });
});
