// Landing entry for the games and tools sites. The page itself is prerendered
// (src/hub/Landing.tsx); this only loads the shared styles, starts analytics,
// and wires the theme toggle.
import '../styles/global';
import { initAnalytics, track } from '../utils/analytics';
import { THEME_KEY, safeSetItem } from '../utils/persistence';

initAnalytics();

document.querySelector<HTMLButtonElement>('[data-theme-toggle]')?.addEventListener('click', () => {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  safeSetItem(THEME_KEY, next);
  track('theme_toggled', { theme: next });
});
