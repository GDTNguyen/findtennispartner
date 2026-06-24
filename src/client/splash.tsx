import './index.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PartnerApp } from './components/partner-app';

export const Splash = () => (
  <PartnerApp
    variant="splash"
    onExpand={(e) => requestExpandedMode(e.nativeEvent, 'game')}
  />
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
