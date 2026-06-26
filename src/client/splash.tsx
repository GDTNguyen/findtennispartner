import './index.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PartnerInlinePreview } from './components/partner-inline-preview';

export const Splash = () => (
  <PartnerInlinePreview onExpand={(e) => requestExpandedMode(e.nativeEvent, 'game')} />
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
