import { StrictMode, useEffect, useState, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.jsx'
import DesktopApp from './DesktopApp.jsx'

const platform = Capacitor.getPlatform?.() || 'web'
document.documentElement.classList.add(`platform-${platform}`)

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'system-ui', textAlign: 'center' }}>
          <h1>Something went wrong.</h1>
          <pre style={{ textAlign: 'left', background: '#f5f5f5', padding: '20px', borderRadius: '8px', overflow: 'auto' }}>
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

if ('virtualKeyboard' in navigator) {
  navigator.virtualKeyboard.overlaysContent = true
}

function ResponsiveRoot() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(min-width: 900px)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const media = window.matchMedia('(min-width: 900px)')
    const onChange = (event) => setIsDesktop(event.matches)

    // Modern browsers support addEventListener, fallback to addListener for older ones
    if (media.addEventListener) {
      media.addEventListener('change', onChange)
    } else {
      media.addListener(onChange)
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', onChange)
      } else {
        media.removeListener(onChange)
      }
    }
  }, [])

  const Component = isDesktop ? DesktopApp : App
  return <Component />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ResponsiveRoot />
    </ErrorBoundary>
  </StrictMode>,
)
