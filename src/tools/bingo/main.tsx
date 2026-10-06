import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles/global';
import { initAnalytics, track } from '../../utils/analytics';
import { importLegacyStorage } from '../../site/legacyStorage';
import App from './App';

initAnalytics();
track('tool_opened', { tool: 'bingo' });

// Mount after the one-time copy of saved data from the old apex origin.
void importLegacyStorage('games').then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
