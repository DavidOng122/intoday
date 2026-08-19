import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles/tokens.css';
import './styles/index.css';
import './styles/desktop.css';
import './features/session/styles/desktopSession.css';
import './features/workspace/styles/desktopWorkspace.css';
import './features/canvas/styles/desktopCanvas.css';
import './features/pack/styles/desktopPack.css';
import './features/search/styles/desktopSearch.css';
import './features/inbox/styles/desktopInbox.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
