import type { GeocodeSearchHit } from '../../shared/api';
import { useLocationSearch } from '../hooks/useLocationSearch';

type LocationSearchProps = {
  onSelect: (hit: GeocodeSearchHit) => void;
};

export function LocationSearch({ onSelect }: LocationSearchProps) {
  const {
    query,
    setQuery,
    results,
    loading,
    menuOpen,
    error,
    closeMenu,
    selectHit,
    submitSearch,
    setMenuOpen,
  } = useLocationSearch({ onSelect });

  return (
    <div className="partner-map-search">
      <form
        className="partner-map-search__form"
        onSubmit={(event) => {
          event.preventDefault();
          void submitSearch();
        }}
      >
        <label className="partner-map-search__label" htmlFor="partner-map-search-input">
          Search location
        </label>
        <div className="partner-map-search__field">
          <input
            id="partner-map-search-input"
            type="search"
            className="partner-map-search__input"
            placeholder="City, court, or address"
            value={query}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onFocus={() => {
              if (results.length > 0) setMenuOpen(true);
            }}
            onBlur={() => {
              window.setTimeout(closeMenu, 150);
            }}
          />
          <button
            type="submit"
            className="partner-map-search__submit"
            disabled={loading || query.trim().length < 2}
            aria-label="Search location"
          >
            {loading ? '…' : 'Go'}
          </button>
        </div>
      </form>

      {menuOpen && results.length > 0 ? (
        <ul className="partner-map-search__results" role="listbox">
          {results.map((hit) => (
            <li key={`${hit.lat},${hit.lon}`}>
              <button
                type="button"
                className="partner-map-search__result"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectHit(hit)}
              >
                {hit.display_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="partner-map-search__error" role="alert">
          {error}
        </p>
      ) : null}

      {query.trim().length >= 2 && !loading && results.length === 0 && menuOpen && !error ? (
        <p className="partner-map-search__empty">No locations found.</p>
      ) : null}
    </div>
  );
}
