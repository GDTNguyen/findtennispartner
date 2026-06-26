import { isInlinePresentation } from './devvit-presentation';

function wheelDeltaPixels(event: WheelEvent): { x: number; y: number } {
  const { deltaMode } = event;
  let { deltaX, deltaY } = event;

  if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
    deltaX *= 16;
    deltaY *= 16;
  } else if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    deltaX *= window.innerWidth;
    deltaY *= window.innerHeight;
  }

  return { x: deltaX, y: deltaY };
}

function scrollElementBy(element: Element, deltaX: number, deltaY: number): boolean {
  if (!(element instanceof HTMLElement)) return false;

  const canScrollY = element.scrollHeight > element.clientHeight + 1;
  const canScrollX = element.scrollWidth > element.clientWidth + 1;
  if (!canScrollY && !canScrollX) return false;

  if (canScrollY) element.scrollTop += deltaY;
  if (canScrollX) element.scrollLeft += deltaX;
  return true;
}

function forwardWheelToParentFeed(event: WheelEvent): void {
  const { x, y } = wheelDeltaPixels(event);
  if (x === 0 && y === 0) return;

  if (window.parent === window) return;

  try {
    const parentDocument = window.parent.document;
    const candidates: Element[] = [
      parentDocument.scrollingElement,
      parentDocument.documentElement,
      parentDocument.body,
      parentDocument.querySelector('shreddit-feed'),
      parentDocument.querySelector('#AppRouter-main-content'),
      parentDocument.querySelector('main'),
    ].filter((element): element is Element => element instanceof Element);

    for (const element of candidates) {
      if (scrollElementBy(element, x, y)) return;
    }
  } catch {
    /* Parent document is not readable (cross-origin). */
  }

  try {
    window.parent.scrollBy({ left: x, top: y, behavior: 'auto' });
  } catch {
    /* Parent scroll is not permitted. */
  }
}

export function installInlineFeedScrollPassthrough(): () => void {
  if (!isInlinePresentation()) {
    return () => {};
  }

  const onWheel = (event: WheelEvent) => {
    forwardWheelToParentFeed(event);
  };

  document.addEventListener('wheel', onWheel, { capture: true, passive: true });
  return () => {
    document.removeEventListener('wheel', onWheel, { capture: true });
  };
}
