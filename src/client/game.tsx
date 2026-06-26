import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PartnerApp } from './components/partner-app';

export const App = () => <PartnerApp />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
