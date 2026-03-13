import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.jsx'

const platform = Capacitor.getPlatform?.() || 'web'
document.documentElement.classList.add(`platform-${platform}`)

if ('virtualKeyboard' in navigator) {
  navigator.virtualKeyboard.overlaysContent = true
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
