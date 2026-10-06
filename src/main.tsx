import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global'
import App from './App.tsx'
import { initAnalytics } from './utils/analytics'
import { importLegacyStorage } from './site/legacyStorage'

initAnalytics()

// Mount after the one-time copy of saved plans from the old apex origin
// (chraegames.cloud/fire-planner/ → fire.chraegames.cloud); see legacyStorage.ts.
void importLegacyStorage('fire').then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
