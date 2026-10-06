// One-time import of localStorage from the old single-origin site.
//
// Until the split every page lived on https://chraegames.cloud, so that is the
// origin holding people's FIRE plans, game saves and to-do lists. localStorage
// is per origin: fire./games./tools.chraegames.cloud start empty. The apex now
// 301s every page but still serves one file, /migrate.html (legacy/migrate.html),
// which answers a postMessage request with the values of the keys asked for.
// The apex and the subdomains are the same *site* (same registrable domain), so
// browsers that partition third-party storage still give the hidden iframe the
// apex's first-party localStorage.
//
// Runs once per origin (DONE_KEY), copies only keys that are missing locally
// (never overwrites newer data on the new site), and gives up after a timeout.
// The old data is left in place.

import { LEGACY_ORIGIN, ROOT_DOMAIN, type SiteId } from './manifest';
import {
  BINGO_KEY,
  CALCULATOR_HISTORY_KEY,
  CITY_KEY,
  CITY_PREFS_KEY,
  GO_KEY,
  INTRO_SEEN_KEY,
  MAGIC_TOWER_KEY,
  MAGIC_TOWER_LANG_KEY,
  MAGIC_TOWER_META_KEY,
  OLD_INPUT_KEY,
  OLD_PLANS_KEY,
  OLD_SCENARIOS_KEY,
  PROFILES_KEY,
  SUDOKU_KEY,
  THEME_KEY,
  TODO_KEY,
  UNIT_CONVERTER_KEY,
  safeSetItem,
} from '../utils/persistence';

export const LEGACY_DONE_KEY = 'chraeLab.legacyImported';
export const LEGACY_BRIDGE_URL = `${LEGACY_ORIGIN}/migrate.html`;
export const REQUEST_TYPE = 'chrae-legacy-request';
export const RESPONSE_TYPE = 'chrae-legacy-data';

/** The keys each site owns. Every key here must also match KEY_OK in legacy/migrate.html. */
export const SITE_STORAGE_KEYS: Record<SiteId, string[]> = {
  fire: [PROFILES_KEY, INTRO_SEEN_KEY, THEME_KEY, OLD_SCENARIOS_KEY, OLD_INPUT_KEY, OLD_PLANS_KEY],
  games: [SUDOKU_KEY, BINGO_KEY, GO_KEY, MAGIC_TOWER_KEY, MAGIC_TOWER_META_KEY, MAGIC_TOWER_LANG_KEY, CITY_KEY, CITY_PREFS_KEY, THEME_KEY],
  tools: [UNIT_CONVERTER_KEY, CALCULATOR_HISTORY_KEY, TODO_KEY, THEME_KEY],
};

/** Only the production subdomains import; localhost, previews and the apex itself never do. */
export function shouldImport(hostname: string): boolean {
  return hostname !== ROOT_DOMAIN && hostname.endsWith(`.${ROOT_DOMAIN}`);
}

interface KeyValueStore {
  getItem(key: string): string | null;
}

/**
 * Which of `data` to write: wanted keys, string values, and only where the new
 * origin has nothing yet. Pure so it can be tested without a DOM.
 */
export function pickImports(store: KeyValueStore, keys: string[], data: unknown): [string, string][] {
  if (!data || typeof data !== 'object') return [];
  const out: [string, string][] = [];
  for (const key of keys) {
    const value = (data as Record<string, unknown>)[key];
    if (typeof value === 'string' && store.getItem(key) === null) out.push([key, value]);
  }
  return out;
}

/**
 * Copies the site's keys from the old apex origin, at most once per browser.
 * Resolves with the keys written (empty when there was nothing to do). Never
 * rejects; callers mount their app after it settles.
 */
export function importLegacyStorage(site: SiteId, timeoutMs = 2500): Promise<string[]> {
  try {
    if (typeof window === 'undefined' || !shouldImport(location.hostname)) return Promise.resolve([]);
    if (localStorage.getItem(LEGACY_DONE_KEY)) return Promise.resolve([]);
  } catch {
    return Promise.resolve([]);
  }
  const keys = SITE_STORAGE_KEYS[site];
  return new Promise(resolve => {
    const frame = document.createElement('iframe');
    frame.src = LEGACY_BRIDGE_URL;
    frame.title = 'storage import';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
    let settled = false;
    const finish = (written: string[]) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      frame.remove();
      // Even a timeout counts: the apex is a courtesy, not something to wait on every visit.
      safeSetItem(LEGACY_DONE_KEY, new Date().toISOString());
      resolve(written);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== LEGACY_ORIGIN || e.source !== frame.contentWindow) return;
      if (!e.data || e.data.type !== RESPONSE_TYPE) return;
      const written: string[] = [];
      try {
        for (const [key, value] of pickImports(localStorage, keys, e.data.data)) {
          if (safeSetItem(key, value)) written.push(key);
        }
      } catch {
        // storage unavailable — nothing imported
      }
      finish(written);
    };
    window.addEventListener('message', onMessage);
    frame.addEventListener('load', () => {
      frame.contentWindow?.postMessage({ type: REQUEST_TYPE, keys }, LEGACY_ORIGIN);
    });
    const timer = setTimeout(() => finish([]), timeoutMs);
    (document.body ?? document.documentElement).appendChild(frame);
  });
}
