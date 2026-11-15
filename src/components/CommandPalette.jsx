import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { Icon, iconFor } from './icons.jsx';

const OPEN_EVENT = 'kindred:command-palette';

/** Opens the palette from anywhere (e.g. the sidebar's "Jump to" button). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

// ⌘K / Ctrl+K command palette (desktop): jump to any page of the current space.
export default function CommandPalette({ links }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    function onOpen() { setOpen(true); }
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return links.filter((l) => !q || l.label.toLowerCase().includes(q));
  }, [links, query]);

  if (!open) return null;

  function go(item) {
    setOpen(false);
    if (item) navigate(item.to);
  }

  function onInputKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); go(items[active]); }
  }

  return (
    <div className="cmdk-backdrop" onMouseDown={() => setOpen(false)}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Jump to" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-input">
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onInputKey}
            placeholder="Type a page or action…"
            aria-label="Search pages and actions"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="cmdk-list">
          <span className="micro-label">Quick actions</span>
          {items.length === 0 && <div className="cmdk-empty">No match</div>}
          {items.map((item, i) => (
            <button
              key={item.to}
              type="button"
              className={`cmdk-item ${i === active ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(item)}
            >
              <Icon name={iconFor(item)} size={18} />
              {item.label}
              {i === active && <span className="kbd"><CornerDownLeft size={11} strokeWidth={2} aria-label="Enter" /></span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
