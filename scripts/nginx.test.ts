import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEGACY_ORIGIN, PAGES, SITES, SITE_IDS, absoluteUrl } from '../src/site/manifest';

// Replays deploy/nginx.conf's apex redirect map in JS so a moved or added page
// can't silently 404 (or land on the wrong site) for old links and bookmarks.
const conf = readFileSync(resolve(__dirname, '../deploy/nginx.conf'), 'utf8');

function legacyMap(): { re: RegExp; target: string }[] {
  const block = conf.match(/map \$request_uri \$legacy_target \{([\s\S]*?)\n\}/)![1];
  return block
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('~') || l.startsWith('default'))
    .map(l => {
      const [pattern, target] = l.replace(/;$/, '').split(/\s+/);
      return { re: pattern === 'default' ? /(?:)/ : new RegExp(pattern.slice(1)), target };
    });
}

function redirect(uri: string): string {
  const rules = legacyMap();
  for (const { re, target } of rules) {
    const m = uri.match(re);
    if (m) return target.replace(/\$(\w+)/g, (_, name: string) => m.groups?.[name] ?? '');
  }
  throw new Error('no default');
}

describe('apex 301 map (deploy/nginx.conf)', () => {
  it('sends every pre-split page to its new canonical URL', () => {
    for (const p of PAGES.filter(p => p.status === 'live' && p.kind !== 'hub')) {
      expect(redirect(`/${p.slug}/`), p.slug).toBe(absoluteUrl(p));
    }
  });

  it('keeps query strings, handles missing trailing slashes, and sends the old hub to the tools landing', () => {
    expect(redirect('/fire-planner')).toBe('https://fire.chraegames.cloud/');
    expect(redirect('/fire-planner/?utm=x')).toBe('https://fire.chraegames.cloud/?utm=x');
    expect(redirect('/sudoku')).toBe('https://games.chraegames.cloud/sudoku');
    expect(redirect('/go/?room=ABCD')).toBe('https://games.chraegames.cloud/go/?room=ABCD');
    expect(redirect('/todo?x=1')).toBe('https://tools.chraegames.cloud/todo?x=1');
    expect(redirect('/')).toBe('https://tools.chraegames.cloud/');
    expect(redirect('/gobble/')).toBe('https://tools.chraegames.cloud/');
  });

  it('serves each site from its own dist folder and lets only the subdomains frame the bridge', () => {
    for (const id of SITE_IDS) {
      const host = new URL(SITES[id].origin).host;
      expect(conf).toMatch(new RegExp(`${host.replace(/\./g, '\\.')}\\s+${id};`));
      expect(conf).toContain(`frame-ancestors`);
      expect(conf.match(/frame-ancestors[^"]*/)![0]).toContain(SITES[id].origin);
    }
    expect(conf).toContain(`server_name ${new URL(LEGACY_ORIGIN).host} www.`);
  });
});
