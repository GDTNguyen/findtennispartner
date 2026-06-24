import { useCallback, useEffect, useState } from 'react';
import type {
  CreatePinRequest,
  InitResponse,
  PartnerPin,
  PartnerPinProfile,
} from '../../shared/api';

type PartnerPinsState = {
  pins: PartnerPin[];
  username: string | null;
  postId: string | null;
  pinProfile: PartnerPinProfile | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
};

export const usePartnerPins = () => {
  const [state, setState] = useState<PartnerPinsState>({
    pins: [],
    username: null,
    postId: null,
    pinProfile: null,
    loading: true,
    saving: false,
    error: null,
  });

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/init');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: InitResponse = await res.json();
        if (data.type !== 'init') throw new Error('Unexpected response');
        setState((prev) => ({
          ...prev,
          pins: data.pins,
          username: data.username,
          postId: data.postId,
          pinProfile: data.pinProfile,
          loading: false,
          error: null,
        }));
      } catch (err) {
        console.error('Failed to init partner pins', err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Could not load the map. Try refreshing.',
        }));
      }
    };
    void init();
  }, []);

  const createPin = useCallback(
    async (payload: CreatePinRequest) => {
      if (!state.postId) {
        setState((prev) => ({ ...prev, error: 'Missing post context.' }));
        return false;
      }

      setState((prev) => ({ ...prev, saving: true, error: null }));
      try {
        const res = await fetch('/api/pins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(typeof data.message === 'string' ? data.message : `HTTP ${res.status}`);
        }
        setState((prev) => ({
          ...prev,
          pins: data.pins,
          pinProfile: data.pinProfile ?? prev.pinProfile,
          saving: false,
          error: null,
        }));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not save your pin.';
        setState((prev) => ({ ...prev, saving: false, error: message }));
        return false;
      }
    },
    [state.postId]
  );

  const deletePin = useCallback(
    async (pinId: string) => {
      if (!state.postId) return false;

      setState((prev) => ({ ...prev, saving: true, error: null }));
      try {
        const res = await fetch(`/api/pins/${encodeURIComponent(pinId)}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(typeof data.message === 'string' ? data.message : `HTTP ${res.status}`);
        }
        setState((prev) => ({
          ...prev,
          pins: data.pins,
          pinProfile: data.pinProfile ?? null,
          saving: false,
          error: null,
        }));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not remove your pin.';
        setState((prev) => ({ ...prev, saving: false, error: message }));
        return false;
      }
    },
    [state.postId]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const myPin =
    state.username && state.username !== 'anonymous'
      ? state.pins.find((pin) => pin.username === state.username) ?? null
      : null;

  return {
    ...state,
    myPin,
    createPin,
    deletePin,
    clearError,
  } as const;
};
