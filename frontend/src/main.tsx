import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Inter for text, Space Grotesk for headings, JetBrains Mono for join codes.
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
