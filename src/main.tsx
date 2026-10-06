import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global'
import App from './App.tsx'
import { initAnalytics } from './utils/analytics'

initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
