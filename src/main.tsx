import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// Fonts are served from our own domain, so no visitor's IP address goes to Google Fonts.
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '@fontsource-variable/figtree/index.css'
import './index.css'
import { registerServiceWorker } from './lib/pwa'
import { initErrorReporting } from './lib/errorReporting'

initErrorReporting();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
