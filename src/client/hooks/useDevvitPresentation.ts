import { useEffect, useState } from 'react';
import {
  getDevvitPresentation,
  syncDevvitPresentationClasses,
  type DevvitPresentation,
} from '../lib/devvit-presentation';

export function useDevvitPresentation(): DevvitPresentation {
  const [presentation, setPresentation] = useState(getDevvitPresentation);

  useEffect(() => {
    const sync = () => {
      syncDevvitPresentationClasses();
      setPresentation(getDevvitPresentation());
    };

    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('message', sync);

    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('message', sync);
    };
  }, []);

  return presentation;
}
