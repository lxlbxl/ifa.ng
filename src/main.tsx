import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './lib/pwa'
import { initErrorReporting } from './lib/errorReporting'

initErrorReporting();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
