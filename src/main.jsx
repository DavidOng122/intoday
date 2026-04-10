import { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { CSPostHogProvider } from './providers';
import { applyPlatformClass } from './hooks/usePlatform';
import './styles/tokens.css';
import './styles/index.css';
import './styles/mobile.css';
import './styles/timeline.css';
import './styles/sheets.css';
import './styles/themes.css';
import './styles/desktop.css';

applyPlatformClass();

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ componentStack: errorInfo?.componentStack || '' });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'system-ui', textAlign: 'center' }}>
          <h1>Something went wrong.</h1>
          <pre style={{ textAlign: 'left', background: '#f5f5f5', padding: '20px', borderRadius: '8px', overflow: 'auto' }}>
            {this.state.error?.toString()}
          </pre>
          {this.state.componentStack ? (
            <pre style={{ textAlign: 'left', background: '#f5f5f5', padding: '20px', borderRadius: '8px', overflow: 'auto', marginTop: '16px' }}>
              {this.state.componentStack}
            </pre>
          ) : null}
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
  navigator.virtualKeyboard.overlaysContent = true;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <CSPostHogProvider>
        <App />
      </CSPostHogProvider>
    </ErrorBoundary>
  </StrictMode>,
);
