import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Manrope is bundled (no Google Fonts) so the demo works offline. Display face per design-system.md §2.
import '@fontsource-variable/manrope';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
