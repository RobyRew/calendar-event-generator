import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Analytics, added at runtime so the tag is absent unless configured — a fork
// with no VITE_UMAMI_* values ships nothing. data-domains restricts reporting to
// the configured host so previews and forks cannot pollute the dashboard.
const umamiSrc = import.meta.env.VITE_UMAMI_SCRIPT_URL;
const umamiId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
if (umamiSrc && umamiId) {
  const s = document.createElement('script');
  s.defer = true;
  s.src = umamiSrc;
  s.dataset.websiteId = umamiId;
  const domains = import.meta.env.VITE_UMAMI_DOMAINS;
  if (domains) s.dataset.domains = domains;
  s.dataset.doNotTrack = 'true';
  document.head.appendChild(s);
}
