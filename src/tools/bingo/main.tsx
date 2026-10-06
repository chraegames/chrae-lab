import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles/global';
import { initAnalytics, track } from '../../utils/analytics';
import App from './App';

initAnalytics();
track('tool_opened', { tool: 'bingo' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
