import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeocodeSearchHit, GeocodeSearchResponse } from '../../shared/api';

type UseLocationSearchOptions = {
  onSelect: (hit: GeocodeSearchHit) => void;
};

type GeocodeErrorResponse = {
  status: 'error';
  message: string;
};

function isGeocodeSearchResponse(data: unknown): data is GeocodeSearchResponse {
  return (
    !!data &&
    typeof data === 'object' &&
    'type' in data &&
    (data as GeocodeSearchResponse).type === 'geocode-search' &&
    Array.isArray((data as GeocodeSearchResponse).results)
  );
}

function geocodeErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as GeocodeErrorResponse).message;
    if (typeof message === 'string') return message;
  }
  return `Search failed (HTTP ${status})`;
}

export function useLocationSearch({ onSelect }: UseLocationSearchOptions) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const setSearchQuery = useCallback((value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      setMenuOpen(false);
      return;
    }
    setMenuOpen(true);
  }, []);

  const selectHit = useCallback((hit: GeocodeSearchHit) => {
    setQuery(hit.display_name);
    setResults([]);
    setMenuOpen(false);
    setError(null);
    onSelectRef.current(hit);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
      const data: unknown = await res.json();
      if (!res.ok) {
        throw new Error(geocodeErrorMessage(data, res.status));
      }
      if (!isGeocodeSearchResponse(data)) {
        throw new Error('Unexpected search response');
      }
      setResults(data.results);
      setMenuOpen(data.results.length > 0);
    } catch (err) {
      setResults([]);
      setMenuOpen(false);
      setError(err instanceof Error ? err.message : 'Could not search for that location.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    debounceRef.current = setTimeout(() => {
      void runSearch(trimmed);
    }, 320);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const submitSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    if (results.length > 0) {
      selectHit(results[0]!);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
      const data: unknown = await res.json();
      if (!res.ok) {
        throw new Error(geocodeErrorMessage(data, res.status));
      }
      if (!isGeocodeSearchResponse(data)) {
        throw new Error('Unexpected search response');
      }
      setResults(data.results);
      if (data.results.length > 0) {
        selectHit(data.results[0]!);
      } else {
        setMenuOpen(true);
      }
    } catch (err) {
      setResults([]);
      setMenuOpen(false);
      setError(err instanceof Error ? err.message : 'Could not search for that location.');
    } finally {
      setLoading(false);
    }
  }, [query, results, selectHit]);

  return {
    query,
    setQuery: setSearchQuery,
    results,
    loading,
    menuOpen,
    error,
    closeMenu,
    selectHit,
    submitSearch,
    setMenuOpen,
  } as const;
}
