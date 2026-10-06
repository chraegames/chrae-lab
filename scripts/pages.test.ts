import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { livePages, SITE_IDS } from '../src/site/manifest';

const SITES_DIR = resolve(__dirname, '..', 'sites');

// The Vite input map is generated from the manifest, so a live entry without a
// matching index.html would only fail at build time. Catch it in tests instead.
describe('live pages have an html entry on disk', () => {
  for (const p of livePages()) {
    it(`${p.site}${p.path}`, () => {
      expect(existsSync(join(SITES_DIR, p.site, p.path.slice(1), 'index.html'))).toBe(true);
    });
  }
});

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return htmlFiles(full);
    return name === 'index.html' ? [full] : [];
  });
}

describe('share images', () => {
  // The PNG header stores width/height at bytes 16–23; 1200×630 is what og:image:width/height promise.
  for (const site of SITE_IDS) {
    it(`sites/${site}/og.png is a 1200×630 PNG`, () => {
      const png = readFileSync(join(SITES_DIR, site, 'og.png'));
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    });
  }

  it('no shared og.png in public/ (public/ ships to every site)', () => {
    expect(existsSync(resolve(__dirname, '..', 'public', 'og.png'))).toBe(false);
  });
});

describe('no stray html entries', () => {
  it('every sites/<site>/**/index.html belongs to a live page of that site', () => {
    for (const site of SITE_IDS) {
      const expected = new Set(livePages(site).map(p => join(SITES_DIR, site, p.path.slice(1), 'index.html')));
      for (const file of htmlFiles(join(SITES_DIR, site))) expect(expected.has(file), file).toBe(true);
    }
  });

  it('the old single-origin entries are gone from the repo root', () => {
    for (const old of ['index.html', 'fire-planner/index.html', 'sudoku/index.html', 'tv-guide/index.html']) {
      expect(existsSync(resolve(__dirname, '..', old)), old).toBe(false);
    }
  });
});
