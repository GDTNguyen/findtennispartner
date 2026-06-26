import type { PartnerPin } from '../../shared/api';

type PartnerPostSheetListener = (pin: PartnerPin | null) => void;

const listeners = new Set<PartnerPostSheetListener>();

export function openPartnerPostSheet(pin: PartnerPin): void {
  for (const listener of listeners) {
    listener(pin);
  }
}

export function closePartnerPostSheet(): void {
  for (const listener of listeners) {
    listener(null);
  }
}

export function subscribePartnerPostSheet(listener: PartnerPostSheetListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
