import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PartnerApp } from './components/partner-app';

export const App = () => <PartnerApp variant="game" />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
