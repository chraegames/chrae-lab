// Landing entry for the games and tools sites. The page itself is prerendered
// (src/hub/Landing.tsx); this only loads the shared styles, starts analytics,
// wires the theme toggle and runs the one-time import from the old apex.
import '../styles/global';
import { initAnalytics, track } from '../utils/analytics';
import { THEME_KEY, safeSetItem } from '../utils/persistence';
import { importLegacyStorage } from '../site/legacyStorage';
import { isSiteId } from '../site/manifest';

initAnalytics();

const site = document.querySelector<HTMLElement>('[data-site]')?.dataset.site;
if (isSiteId(site)) {
  void importLegacyStorage(site).then(imported => {
    // The theme may have just arrived from the old origin.
    if (imported.includes(THEME_KEY)) {
      document.documentElement.setAttribute('data-theme', localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light');
    }
  });
}

document.querySelector<HTMLButtonElement>('[data-theme-toggle]')?.addEventListener('click', () => {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  safeSetItem(THEME_KEY, next);
  track('theme_toggled', { theme: next });
});
