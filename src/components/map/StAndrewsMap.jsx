// Stylised St Andrews map: real OpenStreetMap geometry (stAndrewsGeo.js), drawn as SVG in the
// app's own colours. No map service, no key. Directions hand off to Apple / Google Maps
// (src/lib/maps). Design started from a Lovable prototype, geometry and theming are ours.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BOUNDS, GEO, WORLD_H, WORLD_W } from './stAndrewsGeo.js';
import './map.css';

const M_PER_DEG = 111320;
const COS_LAT = Math.cos((((BOUNDS.latMin + BOUNDS.latMax) / 2) * Math.PI) / 180);
/** WGS84 → map metres (origin north-west corner, y southwards). */
export function project(lat, lng) {
  return { x: (lng - BOUNDS.lngMin) * COS_LAT * M_PER_DEG, y: (BOUNDS.latMax - lat) * M_PER_DEG };
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const LABELS = [
  { t: 'North Sea', c: [56.356, -2.786], kind: 'sea' },
  { t: 'West Sands', c: [56.3552, -2.8175], kind: 'water', rot: 52 },
  { t: 'East Sands', c: [56.3366, -2.7782], kind: 'water', rot: 28 },
  { t: 'Old Course', c: [56.3483, -2.8135] },
  { t: 'Lade Braes', c: [56.3364, -2.8008] },
  { t: 'Botanic Garden', c: [56.3352, -2.8072] },
  { t: 'North Haugh', c: [56.3446, -2.8075] },
];
const GLYPHS = [
  { kind: 'cathedral', c: [56.3398, -2.7866], name: 'Cathedral' },
  { kind: 'castle', c: [56.3419, -2.7905], name: 'Castle' },
  { kind: 'tower', c: [56.3413, -2.7935], name: "St Salvator's" },
];
/** Default view: the town from West Port to the pier. */
const TOWN_VIEW = { latMin: 56.3345, latMax: 56.3445, lngMin: -2.8090, lngMax: -2.7790 };
const MIN_SPAN_M = 900;

function Glyph({ kind }) {
  switch (kind) {
    case 'cathedral':
      return <g className="sam-glyph"><path className="sam-glyph-fill" d="M-7 6 V-6 L-5 -9 L-3 -6 V6 M3 6 V-6 L5 -9 L7 -6 V6" /><path d="M-3 6 V0 A3 3 0 0 1 3 0 V6 M-9 6 H9" /></g>;
    case 'castle':
      return <g className="sam-glyph"><path className="sam-glyph-fill" d="M-6 6 V-4 H-4 V-6 H-2 V-4 H2 V-6 H4 V-4 H6 V6 Z" /><path d="M-1.5 6 V2 A1.5 1.5 0 0 1 1.5 2 V6" /></g>;
    case 'tower':
      return <g className="sam-glyph"><path className="sam-glyph-fill" d="M-3 6 V-3 L0 -10 L3 -3 V6 Z" /><path d="M-3 -3 H3 M-1 1 H1 M-6 6 H6" /></g>;
    default:
      return <g className="sam-glyph"><path className="sam-glyph-fill" d="M-2.5 6 L-1.5 -4 H1.5 L2.5 6 Z" /><path d="M-2 -4 V-6 H2 V-4 M-5 -7 L-3 -6 M5 -7 L3 -6 M-4 6 H4" /></g>;
  }
}

const hasCoords = (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && p.lat !== null && p.lng !== null;

/**
 * pins: [{id, lat, lng, label, title?, tone?: 'match'|'other'}]. `label` is the short pill text
 *   ("Sat 10:00"); `title` is added when the pin is selected ("Beach clean").
 * me: {lat, lng} · radiusKm: dashed circle around me · selectedId / onSelect(id)
 * interactive: drag, pinch, wheel and +/- zoom · height in px · fit: 'pins' (default) | 'town'
 */
export default function StAndrewsMap({
  pins = [], me, radiusKm, selectedId, onSelect, height = 260, interactive = false, fit = 'pins',
  ariaLabel = 'Map of St Andrews', className = '',
}) {
  const uid = useId().replace(/:/g, '');
  const rootRef = useRef(null);
  const [w, setW] = useState(360);
  const h = height;
  const placed = useMemo(() => pins.filter(hasCoords), [pins]);

  const limit = (v, width = w) => {
    const kMin = Math.max(width / WORLD_W, h / WORLD_H);
    const k = clamp(v.k, kMin, kMin * 24);
    return { k, tx: clamp(v.tx, width - WORLD_W * k, 0), ty: clamp(v.ty, h - WORLD_H * k, 0) };
  };
  // Initial view: everything that matters (pins + me) inside, else the town centre.
  const fitView = (width) => {
    const pts = fit === 'pins' ? [...placed, ...(hasCoords(me) ? [me] : [])].map((p) => project(p.lat, p.lng)) : [];
    let box;
    if (pts.length) {
      const xs = pts.map((p) => clamp(p.x, 0, WORLD_W)), ys = pts.map((p) => clamp(p.y, 0, WORLD_H));
      box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
      const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
      const sw = Math.max(box.x1 - box.x0, MIN_SPAN_M), sh = Math.max(box.y1 - box.y0, MIN_SPAN_M * (h / width));
      box = { x0: cx - sw / 2, x1: cx + sw / 2, y0: cy - sh / 2, y1: cy + sh / 2 };
    } else {
      const a = project(TOWN_VIEW.latMax, TOWN_VIEW.lngMin), b = project(TOWN_VIEW.latMin, TOWN_VIEW.lngMax);
      box = { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    }
    // Padding: room for pills above pins and the controls on the right.
    const padL = 40, padR = interactive ? 68 : 40, padTop = 56, padBottom = 36;
    const k = Math.min((width - padL - padR) / (box.x1 - box.x0), (h - padTop - padBottom) / (box.y1 - box.y0));
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
    return limit({ k, tx: padL + (width - padL - padR) / 2 - cx * k, ty: padTop + (h - padTop - padBottom) / 2 - cy * k }, width);
  };

  const [viewState, setView] = useState(null);
  const fitKey = placed.map((p) => p.id).join(',') + (hasCoords(me) ? `|${me.lat},${me.lng}` : '');
  useEffect(() => { setView(null); }, [fitKey]); // refit when the set of pins changes
  const view = viewState ?? fitView(w);
  const k0 = useMemo(() => fitView(w).k, [w, h, fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const viewRef = useRef(view); viewRef.current = view;
  const wRef = useRef(w); wRef.current = w;

  useLayoutEffect(() => {
    const el = rootRef.current; if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => {
      const nw = Math.round(e.contentRect.width);
      if (nw && nw !== wRef.current) { setW(nw); setView(null); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoomAt = (factor, px, py) => setView(() => {
    const v = viewRef.current; const nk = limit({ ...v, k: v.k * factor }).k; const r = nk / v.k;
    return limit({ k: nk, tx: px - (px - v.tx) * r, ty: py - (py - v.ty) * r });
  });

  // ---- gestures ----
  const ptrs = useRef(new Map());
  const moved = useRef(false);
  const downAt = useRef({ x: 0, y: 0 });
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const local = (e) => { const r = rootRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  const onPointerDown = (e) => {
    if (!interactive || e.target.closest('.sam-controls, .sam-credit')) return;
    const p = local(e); ptrs.current.set(e.pointerId, p);
    if (ptrs.current.size === 1) { moved.current = false; downAt.current = p; }
    setDragging(true);
  };
  useEffect(() => {
    if (!interactive) return undefined;
    const move = (e) => {
      const m = ptrs.current; const prev = m.get(e.pointerId); if (!prev || !rootRef.current) return;
      const p = local(e);
      if (Math.hypot(p.x - downAt.current.x, p.y - downAt.current.y) > 6) moved.current = true;
      if (m.size === 1) {
        const v = viewRef.current; setView(limit({ ...v, tx: v.tx + p.x - prev.x, ty: v.ty + p.y - prev.y }, wRef.current));
      } else if (m.size === 2) {
        const other = [...m.entries()].find(([id]) => id !== e.pointerId)[1];
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(p.x - other.x, p.y - other.y);
        const m0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 }, m1 = { x: (p.x + other.x) / 2, y: (p.y + other.y) / 2 };
        const v = viewRef.current; const nk = limit({ ...v, k: v.k * (d0 ? d1 / d0 : 1) }, wRef.current).k; const r = nk / v.k;
        setView(limit({ k: nk, tx: m1.x - (m0.x - v.tx) * r, ty: m1.y - (m0.y - v.ty) * r }, wRef.current));
        moved.current = true;
      }
      m.set(e.pointerId, p);
    };
    const up = (e) => {
      const m = ptrs.current; if (!m.has(e.pointerId)) return;
      m.delete(e.pointerId);
      if (m.size === 0) {
        setDragging(false);
        const onPin = e.target?.closest?.('.sam-pin');
        if (!moved.current && !onPin && rootRef.current) {
          const p = local(e); const now = performance.now(); const lt = lastTap.current;
          if (now - lt.t < 320 && Math.hypot(p.x - lt.x, p.y - lt.y) < 30) { zoomAt(2, p.x, p.y); lastTap.current = { t: 0, x: 0, y: 0 }; }
          else lastTap.current = { t: now, ...p };
        }
      }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [interactive, h]); // eslint-disable-line react-hooks/exhaustive-deps

  const wheelRef = useRef(() => {});
  wheelRef.current = (e) => { const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1); const p = local(e); zoomAt(Math.exp(-dy * 0.002), p.x, p.y); };
  useEffect(() => {
    const el = rootRef.current; if (!el || !interactive) return undefined;
    const fn = (e) => { e.preventDefault(); wheelRef.current(e); };
    el.addEventListener('wheel', fn, { passive: false });
    return () => el.removeEventListener('wheel', fn);
  }, [interactive]);

  const S = (p) => ({ x: p.x * view.k + view.tx, y: p.y * view.k + view.ty });
  const onScreen = (p, m) => p.x > m && p.x < w - m && p.y > 14 && p.y < h - 14;
  const z = clamp(Math.sqrt(view.k / k0), 0.75, 2);
  const detail = view.k > 0.12; // minor streets once a street is more than ~1 px per 8 m

  // ---- pin layout: short pills, full title on the selected one, simple stacking on collision ----
  const laid = useMemo(() => {
    const ordered = [...placed].sort((a, b) => (a.id === selectedId ? -1 : b.id === selectedId ? 1 : 0));
    const boxes = [];
    return ordered.map((pin) => {
      const raw = project(pin.lat, pin.lng);
      const cw = { x: clamp(raw.x, 0, WORLD_W), y: clamp(raw.y, 0, WORLD_H) };
      const out = cw.x !== raw.x || cw.y !== raw.y;
      const angle = (Math.atan2(raw.y - cw.y, raw.x - cw.x) * 180) / Math.PI;
      const s = S(cw);
      const selected = pin.id === selectedId;
      const title = selected && pin.title ? pin.title : '';
      const text = title ? `${pin.label} · ${title}` : pin.label;
      const pw = Math.round(text.length * 6.6 + 22), ph = 24;
      const offX = clamp(s.x - pw / 2, 4, w - 4 - pw) - (s.x - pw / 2);
      let dy = 0;
      for (let i = 0; i < 4; i++) {
        const r = { x: s.x - pw / 2 + offX, y: s.y - 10 - ph + dy, w: pw, h: ph };
        if (!boxes.some((b) => r.x < b.x + b.w + 3 && r.x + r.w + 3 > b.x && r.y < b.y + b.h + 3 && r.y + r.h + 3 > b.y) || i === 3) { boxes.push(r); break; }
        dy -= ph + 5;
      }
      return { pin, s, out, angle, pw, ph, offX, dy, selected, title };
    }).reverse();
  }, [placed, selectedId, view.k, view.tx, view.ty, w]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (id) => { if (!moved.current) onSelect?.(id); };
  const onKey = (e, id) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(id); } };

  const meW = hasCoords(me) ? project(me.lat, me.lng) : null;
  const meS = meW ? S(meW) : null;
  const scaleM = view.k * 500 > 140 ? 200 : view.k * 500 < 40 ? 1000 : 500;

  return (
    <div
      ref={rootRef}
      className={`sam-root${className ? ` ${className}` : ''}`}
      style={{ height: h }}
      data-interactive={interactive ? 'true' : undefined}
      data-dragging={dragging ? 'true' : undefined}
      onPointerDown={onPointerDown}
    >
      <svg className="sam-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel} style={{ '--sam-z': z }}>
        <rect className="sam-sea" x={0} y={0} width={w} height={h} />
        <g transform={`matrix(${view.k} 0 0 ${view.k} ${view.tx} ${view.ty})`}>
          <path className="sam-land" d={GEO.land} />
          <path className="sam-fields" d={GEO.fields} />
          <path className="sam-town" d={GEO.town} />
          <path className="sam-park" d={GEO.park} />
          <path className="sam-golf" d={GEO.golf} />
          <path className="sam-beach" d={GEO.beach} />
          <path className="sam-coast" d={GEO.land} />
          <path className="sam-water" d={GEO.water} />
          <path className="sam-path" d={GEO.paths} />
          {detail && <path className="sam-casing sam-minor" d={GEO.minor} />}
          <path className="sam-casing sam-major" d={GEO.major} />
          {detail && <path className="sam-street sam-minor" d={GEO.minor} />}
          <path className="sam-street sam-major" d={GEO.major} />
          <path className="sam-pier" d={GEO.piers} />
          {meW && radiusKm ? <circle className="sam-radius" cx={meW.x} cy={meW.y} r={radiusKm * 1000} /> : null}
        </g>

        {LABELS.map((l) => {
          const p = S(project(l.c[0], l.c[1]));
          if (!onScreen(p, 50)) return null;
          return (
            <text
              key={l.t}
              className={`sam-label${l.kind ? ' sam-label-water' : ''}${l.kind === 'sea' ? ' sam-label-sea' : ''}`}
              x={p.x} y={p.y} textAnchor="middle"
              transform={l.rot ? `rotate(${l.rot} ${p.x} ${p.y})` : undefined}
            >
              {l.kind === 'sea' ? l.t.toUpperCase() : l.t}
            </text>
          );
        })}
        {GLYPHS.map((g) => {
          const p = S(project(g.c[0], g.c[1]));
          if (!onScreen(p, 12)) return null;
          return <g key={g.name} transform={`translate(${p.x} ${p.y})`} aria-hidden="true"><Glyph kind={g.kind} /></g>;
        })}

        {meS && (
          <g aria-hidden="true">
            <circle className="sam-me-pulse" cx={meS.x} cy={meS.y} r={10} />
            <circle className="sam-me-dot" cx={meS.x} cy={meS.y} r={6} />
          </g>
        )}

        <g transform={`translate(12 ${h - 24})`} aria-hidden="true">
          <path className="sam-scale-line" d={`M0 -5 V0 H${scaleM * view.k} V-5`} />
          <text className="sam-scale-text" x={scaleM * view.k + 6} y={0}>{scaleM >= 1000 ? `${scaleM / 1000} km` : `${scaleM} m`}</text>
        </g>
        <defs>
          <filter id={`${uid}-glow`} x="-50%" y="-80%" width="200%" height="260%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" className="sam-glow" floodOpacity="0.35" />
          </filter>
        </defs>
      </svg>

      <svg className="sam-overlay" viewBox={`0 0 ${w} ${h}`} role="group" aria-label="Shifts on the map">
        {laid.map(({ pin, s, out, angle, pw, ph, offX, dy, selected, title }) => {
          const top = -10 - ph + dy;
          return (
            <g
              key={pin.id}
              className="sam-pin"
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${pin.title ? `${pin.title}, ${pin.label}` : pin.label}${out ? ', outside the map' : ''}`}
              data-tone={pin.tone ?? 'match'}
              data-selected={selected ? 'true' : undefined}
              transform={`translate(${s.x} ${s.y})`}
              onClick={() => select(pin.id)}
              onKeyDown={(e) => onKey(e, pin.id)}
            >
              <g filter={selected ? `url(#${uid}-glow)` : undefined}>
                <rect className="sam-pin-hit" x={offX - pw / 2 - 2} y={top - 10} width={pw + 4} height={Math.max(44, -top + 12)} />
                {dy !== 0 && <line className="sam-stem" x1={0} y1={-2} x2={0} y2={top + ph} />}
                <path className="sam-pointer" d={`M-5 ${top + ph - 1} L0 ${top + ph + 7} L5 ${top + ph - 1} Z`} />
                <rect className="sam-pill" x={offX - pw / 2} y={top} width={pw} height={ph} rx={ph / 2} />
                <text className="sam-pill-text" x={offX} y={top + ph / 2 + 4} textAnchor="middle">
                  <tspan className="sam-pill-strong">{pin.label}</tspan>{title ? ` · ${title}` : ''}
                </text>
                {out ? <path className="sam-out-arrow" transform={`rotate(${angle})`} d="M2 -4 L9 0 L2 4 Z" /> : <circle className="sam-anchor" r={3.5} />}
              </g>
            </g>
          );
        })}
      </svg>

      <a className="sam-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>
      {interactive && (
        <div className="sam-controls">
          <button type="button" className="sam-btn" aria-label="Zoom in" onClick={() => zoomAt(1.6, w / 2, h / 2)}>+</button>
          <button type="button" className="sam-btn" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.6, w / 2, h / 2)}>−</button>
        </div>
      )}
    </div>
  );
}
