import { describe, it, expect } from 'vitest';
import { ANTI_FLASH_STYLE, THEME_BOOT_SCRIPT, buildHeadTags } from './head';
import { SITES, SITE_REPO, bySlug, siteHome } from '../src/site/manifest';
import { THEME_KEY } from '../src/utils/persistence';

function find(tags: ReturnType<typeof buildHeadTags>, pred: (t: (typeof tags)[number]) => boolean) {
  return tags.filter(pred);
}

function ld(slug: string) {
  return find(buildHeadTags(bySlug(slug)), t => t.attrs?.type === 'application/ld+json').map(t => JSON.parse(t.children!));
}

describe('buildHeadTags', () => {
  it('emits canonical + og:url on the page\'s own subdomain', () => {
    const entry = bySlug('fire-planner/how-it-works');
    const tags = buildHeadTags(entry);
    const canonical = find(tags, t => t.tag === 'link' && t.attrs?.rel === 'canonical')[0];
    expect(canonical.attrs?.href).toBe('https://fire.chraegames.cloud/how-it-works/');
    const ogUrl = find(tags, t => t.attrs?.property === 'og:url')[0];
    expect(ogUrl.attrs?.content).toBe('https://fire.chraegames.cloud/how-it-works/');
    expect(find(tags, t => t.tag === 'title')[0].children).toBe(entry.title);
    expect(find(tags, t => t.attrs?.property === 'og:site_name')[0].attrs?.content).toBe('FIRE Planner');
    expect(find(tags, t => t.attrs?.property === 'og:image')[0].attrs?.content).toBe('https://fire.chraegames.cloud/og.png');

    const sudoku = buildHeadTags(bySlug('sudoku'));
    expect(find(sudoku, t => t.attrs?.rel === 'canonical')[0].attrs?.href).toBe('https://games.chraegames.cloud/sudoku/');
    expect(find(sudoku, t => t.attrs?.property === 'og:site_name')[0].attrs?.content).toBe('Chrae Games');
  });

  it('landings have WebSite + ItemList of their own apps and no BreadcrumbList', () => {
    const games = ld('games');
    expect(games.map(b => b['@type']).sort()).toEqual(['ItemList', 'WebSite']);
    expect(games.find(b => b['@type'] === 'WebSite').publisher.sameAs).toEqual([SITE_REPO]);
    const list = games.find(b => b['@type'] === 'ItemList');
    expect(list.itemListElement.map((i: { name: string }) => i.name)).toContain('Sudoku');
    expect(list.itemListElement.map((i: { name: string }) => i.name)).not.toContain('Calculator');
    expect(list.itemListElement[0].url).toBe(`${SITES.games.origin}/sudoku/`);

    const tools = ld('tools');
    const toolList = tools.find(b => b['@type'] === 'ItemList');
    expect(toolList.itemListElement.map((i: { name: string }) => i.name)).toContain('Calculator');
    expect(toolList.itemListElement.map((i: { name: string }) => i.name)).not.toContain('FIRE Planner');
    expect(find(buildHeadTags(siteHome('tools')), t => t.attrs?.name === 'google-site-verification')).toHaveLength(1);
  });

  it('FIRE content pages get a two-level trail on the fire origin', () => {
    const blocks = ld('fire-planner/how-it-works');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]['@type']).toBe('BreadcrumbList');
    expect(blocks[0].itemListElement.map((i: { name: string }) => i.name)).toEqual(['FIRE Planner', 'How it works']);
    expect(blocks[0].itemListElement[0].item).toBe('https://fire.chraegames.cloud/');
    expect(blocks[0].itemListElement[1].item).toBe('https://fire.chraegames.cloud/how-it-works/');
  });

  it('FIRE home carries WebApplication + FAQPage (no one-item trail) and the verification metas', () => {
    const tags = buildHeadTags(bySlug('fire-planner'));
    const blocks = ld('fire-planner');
    expect(blocks.map(b => b['@type'])).toEqual(['WebApplication', 'FAQPage']);
    expect(blocks[0].url).toBe('https://fire.chraegames.cloud/');
    expect(find(tags, t => t.attrs?.name === 'google-site-verification')).toHaveLength(1);
  });

  it('prepends the theme boot script, keyed on the shared THEME_KEY', () => {
    const tags = buildHeadTags(siteHome('games'));
    expect(tags[0].injectTo).toBe('head-prepend');
    expect(tags[0].children).toBe(THEME_BOOT_SCRIPT);
    expect(THEME_BOOT_SCRIPT).toContain(`'${THEME_KEY}'`);
    // first-paint backgrounds must equal --bg in tokens.css (light / dark)
    expect(ANTI_FLASH_STYLE).toContain('#FAF9F6');
    expect(ANTI_FLASH_STYLE).toContain('#0F1113');
    expect(tags.some(t => t.tag === 'style' && t.children === ANTI_FLASH_STYLE)).toBe(true);
  });

  it('tool pages derive WebApplication + FAQPage from their About copy', () => {
    const entry = bySlug('sudoku');
    const blocks = ld('sudoku');
    expect(blocks.map(b => b['@type'])).toEqual(['BreadcrumbList', 'WebApplication', 'FAQPage']);
    expect(blocks[0].itemListElement.map((i: { name: string }) => i.name)).toEqual(['Chrae Games', 'Sudoku']);
    expect(blocks[1].applicationCategory).toBe('GameApplication');
    expect(blocks[1].url).toBe(`${SITES.games.origin}/sudoku/`);
    expect(blocks[2].mainEntity.map((q: { name: string }) => q.name)).toEqual(entry.about!.faq.map(f => f.q));
    expect(blocks[2].mainEntity[0].acceptedAnswer.text).toBe(entry.about!.faq[0].a);
  });

  it('TV guide: the parent app derives WebApplication + FAQPage; chapters carry a dated Article', () => {
    expect(ld('tv-guide').map(b => b['@type'])).toEqual(['BreadcrumbList', 'WebApplication', 'FAQPage']);
    const tech = bySlug('tv-guide/technologies');
    const blocks = ld('tv-guide/technologies');
    expect(blocks.map(b => b['@type'])).toEqual(['BreadcrumbList', 'Article']);
    expect(blocks[0].itemListElement.map((i: { name: string }) => i.name)).toEqual(['Chrae Tools', 'TV buying guide', 'TV technologies explained']);
    expect(blocks[1].dateModified).toBe(tech.updated);
    expect(blocks[1].url).toBe(`${SITES.tools.origin}/tv-guide/technologies/`);
    expect(find(buildHeadTags(tech), t => t.attrs?.property === 'og:type')[0].attrs?.content).toBe('article');
    expect(ld('tv-guide/decoder')).toHaveLength(1);
  });

  it('no tag anywhere points at the bare apex or the old fireplan host', () => {
    for (const slug of ['games', 'tools', 'fire-planner', 'sudoku', 'tv-guide/brands', 'fire-planner/4-percent-rule']) {
      const text = JSON.stringify(buildHeadTags(bySlug(slug)));
      expect(text, slug).not.toMatch(/https:\/\/(www\.)?chraegames\.cloud/);
      expect(text, slug).not.toContain('fireplan.');
    }
  });
});
