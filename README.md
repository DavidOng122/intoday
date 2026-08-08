# IntoDay

IntoDay is a Desktop Web Application designed for organizing your day.

## Product Support & Architecture

- **Desktop-Only UI**: The product exclusively supports the Desktop UI across all devices and screen sizes. Mobile web browsers render the same Desktop UI without viewport redirection or "unsupported device" screens.
- **Desktop PWA Supported**: PWA capabilities (Manifest & Service Worker) are fully active. Desktop browsers can install the app natively via the address bar or browser menu without custom install popups.
- **Native Apps Removed**: Android and iOS native wrapper projects (Capacitor) have been permanently removed.

## Development

```bash
# Start web dev server
npm run dev

# Run logic unit tests
npm run test:logic

# Production web build
npm run build:web
```
