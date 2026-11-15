import { useEffect, useId, useRef, useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import { Button } from './ui/index.js';
import { currentPosition, mapLink, reverseGeocode, searchAddress } from '../lib/address.js';

/**
 * Address input with UK address suggestions and "Use my location".
 * value: {address, lat, lng}; onChange gets the same shape. The pin (lat, lng) moves only when an
 * address is picked or the location is used, so small edits ("Flat 2, …") keep the pin.
 */
export default function AddressField({ value, onChange, label = 'Address', required = false }) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState(null); // text typed since the last pick
  const [options, setOptions] = useState([]);
  const [active, setActive] = useState(-1);
  const [searchError, setSearchError] = useState('');
  const [pinned, setPinned] = useState(value.lat != null ? value.address : null);
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState(null); // {tone, text}
  const blurTimer = useRef(null);

  useEffect(() => {
    if (!query || query.trim().length < 3) { setOptions([]); setSearchError(''); return undefined; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchAddress(query, { signal: ctrl.signal })
        .then((list) => { setOptions(list); setActive(-1); setSearchError(''); })
        .catch((e) => { if (e.name !== 'AbortError') { setOptions([]); setSearchError(e.message); } });
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  useEffect(() => () => clearTimeout(blurTimer.current), []);

  function pick(place) {
    onChange(place);
    setPinned(place.address);
    setQuery(null);
    setOptions([]);
    setLocNote(null);
  }

  function onKeyDown(e) {
    if (!options.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % options.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? options.length - 1 : i - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(options[active]); }
    else if (e.key === 'Escape') { setOptions([]); }
  }

  async function useMyLocation() {
    setLocating(true);
    setLocNote(null);
    setOptions([]);
    try {
      const pos = await currentPosition();
      const place = await reverseGeocode(pos).catch(() => null);
      const rounded = Math.round(pos.accuracy);
      if (place) {
        pick(place);
      } else {
        onChange({ ...value, lat: pos.lat, lng: pos.lng });
        setPinned(value.address || 'Your location');
      }
      if (!place) setLocNote({ tone: 'warning', text: 'No address found here. Type the address; the pin stays at your location.' });
      else if (rounded > 100) setLocNote({ tone: 'warning', text: `Your location is accurate to about ${rounded} m. Check the address.` });
    } catch (e) {
      setLocNote({ tone: 'danger', text: e.message });
    } finally {
      setLocating(false);
    }
  }

  const open = options.length > 0;

  return (
    <div className="field addr">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="addr-combo">
        <input
          id={id}
          className="field-control"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="street-address"
          placeholder="Start typing a street, building or postcode"
          required={required}
          value={value.address}
          onChange={(e) => { onChange({ ...value, address: e.target.value }); setQuery(e.target.value); }}
          onKeyDown={onKeyDown}
          onBlur={() => { blurTimer.current = setTimeout(() => setOptions([]), 150); }}
        />
        {open && (
          <ul id={listId} role="listbox" className="addr-list" aria-label="Matching addresses">
            {options.map((p, i) => (
              <li
                key={`${p.address}|${p.lat}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className="addr-option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
              >
                <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>{p.address}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {searchError && <p className="field-error">{searchError}</p>}
      {!open && !searchError && value.lat == null && value.address.trim().length >= 3 && (
        <p className="field-hint">Pick your address from the list, or use your location.</p>
      )}
      <div className="row-wrap">
        <Button variant="secondary" size="sm" loading={locating} onClick={useMyLocation}>
          <LocateFixed size={16} strokeWidth={1.75} aria-hidden="true" /> Use my location
        </Button>
        {value.lat != null && value.lng != null && (
          <a className="addr-pin" href={mapLink(value)} target="_blank" rel="noopener noreferrer">
            <MapPin size={14} strokeWidth={2} aria-hidden="true" />
            {pinned && pinned !== value.address ? `Pinned at ${pinned}` : 'Check the pin on a map'}
          </a>
        )}
      </div>
      {locNote && <p className={locNote.tone === 'danger' ? 'field-error' : 'field-hint addr-warn'}>{locNote.text}</p>}
    </div>
  );
}
