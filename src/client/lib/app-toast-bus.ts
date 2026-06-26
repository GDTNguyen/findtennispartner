export type AppToastMessage = {
  variant: 'success' | 'error';
  text: string;
};

type AppToastListener = (message: AppToastMessage) => void;

const listeners = new Set<AppToastListener>();

export function pushAppToast(message: AppToastMessage): void {
  for (const listener of listeners) {
    listener(message);
  }
}

export function subscribeAppToast(listener: AppToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
