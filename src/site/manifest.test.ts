import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  PAGES,
  SITES,
  SITE_IDS,
  absoluteUrl,
  breadcrumbs,
  byPath,
  bySlug,
  contentPages,
  hrefFor,
  livePages,
  liveTools,
  otherSites,
  pathFor,
  relatedTools,
  siteHome,
} from './manifest';

describe('site manifest', () => {
  it('has well-formed paths, unique per site, and globally unique slugs', () => {
    const seen = new Set<string>();
    const slugs = new Set<string>();
    for (const p of PAGES) {
      expect(p.path.startsWith('/')).toBe(true);
      expect(p.path.endsWith('/')).toBe(true);
      expect(seen.has(`${p.site}${p.path}`), p.slug).toBe(false);
      expect(slugs.has(p.slug)).toBe(false);
      seen.add(`${p.site}${p.path}`);
      slugs.add(p.slug);
    }
  });


  it('every site has exactly one home at "/": the planner on fire, a landing on games and tools', () => {
    for (const id of SITE_IDS) {
      expect(PAGES.filter(p => p.site === id && p.path === '/')).toHaveLength(1);
      expect(SITES[id].origin).toBe(`https://${id}.chraegames.cloud`);
    }
    expect(siteHome('fire').slug).toBe('fire-planner');
    expect(siteHome('games').kind).toBe('hub');
    expect(siteHome('tools').kind).toBe('hub');
    expect(PAGES.filter(p => p.kind === 'hub').map(p => p.site).sort()).toEqual(['games', 'tools']);
  });

  it('categories map onto sites: finance → fire, games → games, the rest → tools', () => {
    const siteFor = { finance: 'fire', games: 'games', utilities: 'tools', productivity: 'tools' } as const;
    for (const p of liveTools()) expect(p.site, p.slug).toBe(siteFor[p.category!]);
  });

  it('every app has a known category and every content page a known area on its own site', () => {
    const categoryIds = new Set(CATEGORIES.map(c => c.id));
    for (const p of PAGES) {
      if (p.kind === 'app') expect(categoryIds.has(p.category!)).toBe(true);
      if (p.kind === 'content') {
        const parent = PAGES.find(q => q.slug === p.area);
        expect(parent?.kind).toBe('app');
        expect(parent?.site).toBe(p.site);
        expect(p.label).toBeTruthy();
      }
    }
  });

  it('helpers resolve as expected', () => {
    expect(pathFor('fire-planner')).toBe('/');
    expect(pathFor('fire-planner/how-it-works')).toBe('/how-it-works/');
    expect(() => pathFor('nope')).toThrow();
    expect(() => bySlug('nope')).toThrow();
    expect(byPath('fire', '/how-it-works/')?.area).toBe('fire-planner');
    expect(byPath('games', '/how-it-works/')).toBeUndefined();
    expect(byPath('games', '/sudoku/')).toBe(bySlug('sudoku'));
    expect(liveTools().filter(p => p.category === 'finance').map(p => p.slug)).toEqual(['fire-planner']);
    expect(livePages().every(p => p.status === 'live')).toBe(true);
    expect(livePages('games').every(p => p.site === 'games')).toBe(true);
    expect(absoluteUrl(bySlug('todo'))).toBe('https://tools.chraegames.cloud/todo/');
    expect(absoluteUrl(bySlug('fire-planner'))).toBe('https://fire.chraegames.cloud/');
  });

  it('hrefFor is relative on the same site and absolute across sites', () => {
    expect(hrefFor(bySlug('bingo'), 'games')).toBe('/bingo/');
    expect(hrefFor(bySlug('bingo'), 'tools')).toBe('https://games.chraegames.cloud/bingo/');
    expect(hrefFor(siteHome('fire'), 'games')).toBe('https://fire.chraegames.cloud/');
    expect(otherSites('games').map(p => p.site)).toEqual(['fire', 'tools']);
  });

  it('breadcrumbs run site home → parent app → page, without repeats', () => {
    expect(breadcrumbs(siteHome('games')).map(p => p.slug)).toEqual(['games']);
    expect(breadcrumbs(bySlug('fire-planner')).map(p => p.slug)).toEqual(['fire-planner']);
    expect(breadcrumbs(bySlug('fire-planner/how-it-works')).map(p => p.slug)).toEqual([
      'fire-planner',
      'fire-planner/how-it-works',
    ]);
    expect(breadcrumbs(bySlug('sudoku')).map(p => p.name)).toEqual(['Chrae Games', 'Sudoku']);
    expect(breadcrumbs(bySlug('tv-guide/decoder')).map(p => p.name)).toEqual([
      'Chrae Tools',
      'TV buying guide',
      'TV name decoder',
    ]);
  });

  it('the TV guide is a utilities app whose chapters are content pages beneath it', () => {
    const guide = bySlug('tv-guide');
    expect(guide.kind).toBe('app');
    expect(guide.category).toBe('utilities');
    expect(liveTools('tools').filter(p => p.category === 'utilities').map(p => p.slug)).toContain('tv-guide');
    expect(relatedTools(guide).map(p => p.slug)).not.toContain('tv-guide');
    expect(relatedTools(guide)[0]).toBe(bySlug('unit-converter'));
    for (const c of contentPages().filter(p => p.area === 'tv-guide')) {
      expect(c.path.startsWith('/tv-guide/')).toBe(true);
      expect(c.label).toBeTruthy();
    }
  });

  it('related tools never cross sites', () => {
    for (const t of liveTools()) for (const r of relatedTools(t)) expect(r.site, `${t.slug} → ${r.slug}`).toBe(t.site);
    expect(relatedTools(bySlug('fire-planner'))).toEqual([]);
  });

  it('every live non-FIRE tool carries About copy with features + FAQs', () => {
    for (const p of liveTools().filter(p => p.slug !== 'fire-planner')) {
      expect(p.about, p.slug).toBeDefined();
      expect(p.about!.features.length).toBeGreaterThanOrEqual(3);
      expect(p.about!.faq.length).toBeGreaterThanOrEqual(3);
      expect(p.about!.intro.length).toBeGreaterThan(40);
      expect(p.about!.applicationCategory).toMatch(/Application$/);
    }
  });

  it('updated dates are ISO days and every live page has one', () => {
    for (const p of livePages()) expect(p.updated, p.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('liveTools / contentPages filter by kind, status and site', () => {
    expect(liveTools().every(p => p.kind === 'app' && p.status === 'live')).toBe(true);
    expect(liveTools('games').map(p => p.slug)).toEqual(['sudoku', 'bingo', 'go', 'magic-tower', 'city']);
    expect(liveTools('tools').map(p => p.slug)).toEqual(['unit-converter', 'calculator', 'todo', 'tv-guide']);
    expect(liveTools('fire').map(p => p.slug)).toEqual(['fire-planner']);
    expect(liveTools()).toEqual(PAGES.filter(p => p.kind === 'app' && p.status === 'live'));
    expect(contentPages().every(p => p.kind === 'content')).toBe(true);
    expect(contentPages()).toHaveLength(8);
    expect(contentPages('games')).toHaveLength(0);
    expect(contentPages().filter(p => p.area === 'tv-guide').map(p => p.slug)).toEqual([
      'tv-guide/technologies',
      'tv-guide/brands',
      'tv-guide/decoder',
      'tv-guide/compare',
    ]);
    const rel = relatedTools(bySlug('calculator')).map(p => p.slug);
    expect(rel[0]).toBe('unit-converter'); // same category first
    expect(rel).not.toContain('calculator');
  });
});
