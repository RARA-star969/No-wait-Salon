import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AdminApp} from './components/AdminApp.tsx';
import './index.css';

// Builds that declare a mode keep it exactly: the admin static site
// (VITE_APP_MODE=admin) and the packaged Customer/Staff Android bundles are
// unaffected by the path check below.
//
// The plain `pnpm build` output serves the whole platform from one origin, so
// it resolves the mode at runtime instead: /admin renders the Admin panel and
// everything else renders the Customer app. This lets a single deployment
// generate and preview business QR codes that point back at its own host.
// Diagnostic-only: a crash outside React's render phase (an event handler, a
// timer callback, an unhandled promise) never reaches a component's
// ErrorBoundary. Logging it here means it still shows up in Chrome remote
// debugging / adb logcat on a real device instead of failing silently.
window.addEventListener('error', (event) => {
  console.error('[global error]', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandled rejection]', event.reason);
});

const declaredMode = import.meta.env.VITE_APP_MODE;
const isAdminPath = /^\/admin(\/|$)/.test(window.location.pathname);
const RootApp = declaredMode === 'admin' || (!declaredMode && isAdminPath) ? AdminApp : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
