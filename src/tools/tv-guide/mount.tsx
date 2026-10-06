// Shared client entry for the five guide pages; each entries/<page>.tsx calls
// mountGuide('<page>'). Replaces (never hydrates) the prerendered #root.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles/global';
import { initAnalytics, track } from '../../utils/analytics';
import GuideApp from './App';
import type { GuidePageId } from './pages';

export function mountGuide(page: GuidePageId): void {
  initAnalytics();
  track('tool_opened', { tool: 'tv-guide', page });
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <GuideApp page={page} />
    </StrictMode>,
  );
}
