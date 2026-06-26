import { getWebViewMode, type WebViewMode } from '@devvit/web/client';

export type DevvitPresentation = WebViewMode;

function entrypointPresentation(): DevvitPresentation | null {
  if (typeof document === 'undefined') return null;

  const entry = document.documentElement.dataset.devvitEntry;
  if (entry === 'expanded') return 'expanded';
  if (entry === 'inline') return 'inline';
  return null;
}

/**
 * Resolve inline vs expanded presentation.
 * `getWebViewMode()` can report `inline` before Reddit sets immersive mode,
 * so the entrypoint hint on `<html data-devvit-entry>` is used as a fallback.
 */
export function getDevvitPresentation(): DevvitPresentation {
  const mode = getWebViewMode();
  if (mode === 'expanded') return 'expanded';

  const entry = entrypointPresentation();
  if (entry === 'expanded') return 'expanded';

  return 'inline';
}

export function isInlinePresentation(): boolean {
  return getDevvitPresentation() === 'inline';
}

export function isExpandedPresentation(): boolean {
  return getDevvitPresentation() === 'expanded';
}

export function syncDevvitPresentationClasses(): DevvitPresentation {
  const presentation = getDevvitPresentation();
  const root = document.documentElement;

  root.classList.toggle('devvit-expanded', presentation === 'expanded');
  root.classList.toggle('devvit-inline', presentation === 'inline');

  return presentation;
}
