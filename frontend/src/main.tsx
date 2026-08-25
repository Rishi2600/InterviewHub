import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 'standard' is the two-axis Archivo build (weight 100-900 AND width
// 62-125%). The default entry ships weight only, which would silently drop
// the narrowed header style. JetBrains Mono covers every number.
import '@fontsource-variable/archivo/standard.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
