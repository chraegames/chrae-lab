import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEGACY_BRIDGE_URL, REQUEST_TYPE, RESPONSE_TYPE, SITE_STORAGE_KEYS, pickImports, shouldImport } from '../src/site/legacyStorage';
import { SITE_IDS, SITES } from '../src/site/manifest';
import * as persistence from '../src/utils/persistence';

const bridge = readFileSync(resolve(__dirname, '../legacy/migrate.html'), 'utf8');

function store(entries: Record<string, string>) {
  return { getItem: (k: string) => (k in entries ? entries[k] : null) };
}

describe('legacy storage import', () => {
  it('only runs on the production subdomains', () => {
    expect(shouldImport('fire.chraegames.cloud')).toBe(true);
    expect(shouldImport('games.chraegames.cloud')).toBe(true);
    expect(shouldImport('chraegames.cloud')).toBe(false);
    expect(shouldImport('localhost')).toBe(false);
    expect(shouldImport('evilchraegames.cloud')).toBe(false);
    expect(LEGACY_BRIDGE_URL).toBe('https://chraegames.cloud/migrate.html');
  });

  it('copies wanted string values that are missing locally, never overwriting', () => {
    const keys = ['a', 'b', 'c', 'd'];
    const picked = pickImports(store({ b: 'mine' }), keys, { a: '1', b: 'theirs', c: 3, x: 'unasked' });
    expect(picked).toEqual([['a', '1']]);
    expect(pickImports(store({}), keys, null)).toEqual([]);
    expect(pickImports(store({}), keys, 'nope')).toEqual([]);
  });

  it('every persisted key is owned by exactly the site that uses it (theme by all)', () => {
    const declared = Object.entries(persistence)
      .filter(([name, v]) => name.endsWith('_KEY') && typeof v === 'string')
      .map(([, v]) => v as string);
    const owned = new Set(SITE_IDS.flatMap(s => SITE_STORAGE_KEYS[s]));
    for (const key of declared) expect(owned.has(key), key).toBe(true);
    for (const site of SITE_IDS) expect(SITE_STORAGE_KEYS[site]).toContain(persistence.THEME_KEY);
    expect(SITE_STORAGE_KEYS.fire).toContain(persistence.PROFILES_KEY);
    expect(SITE_STORAGE_KEYS.games).not.toContain(persistence.PROFILES_KEY);
  });

  it('the apex bridge page agrees with the client on keys, origins and message types', () => {
    const keyOk = new RegExp(bridge.match(/var KEY_OK = \/(.+)\/;/)![1]);
    for (const site of SITE_IDS) for (const key of SITE_STORAGE_KEYS[site]) expect(keyOk.test(key), key).toBe(true);
    expect(keyOk.test('some-other-app-secret')).toBe(false);
    const allowed = new RegExp(bridge.match(/var ALLOWED_ORIGIN = \/(.+)\/;/)![1]);
    for (const site of SITE_IDS) expect(allowed.test(SITES[site].origin)).toBe(true);
    expect(allowed.test('https://evil.example')).toBe(false);
    expect(allowed.test('https://fire.chraegames.cloud.evil.example')).toBe(false);
    expect(bridge).toContain(`'${REQUEST_TYPE}'`);
    expect(bridge).toContain(`'${RESPONSE_TYPE}'`);
  });
});
