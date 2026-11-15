import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { CharityGate, Empty, ErrorNote, Loading, StatusPill } from './components.jsx';
import { CATEGORIES, REQUEST_STATUSES, fmtShift, labelOf, nextShifts, scheduleSummary } from './shared.js';

function List() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = REQUEST_STATUSES.some((s) => s.value === params.get('status')) ? params.get('status') : 'open';
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    supabase.from('requests')
      .select('*, signups(status)')
      .eq('charity_id', user.id)
      .eq('status', status)
      .order('starts_at', { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err); else setRows(data ?? []);
      });
    return () => { cancelled = true; };
  }, [user.id, status]);

  return (
    <section className="ch-page">
      <header className="ch-head">
        <h1>Requests</h1>
        <Link className="button" to="/charity/requests/new">+ New request</Link>
      </header>

      <div className="ch-tabs" role="tablist" aria-label="Status">
        {REQUEST_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={status === s.value}
            className={`ch-tab ${status === s.value ? 'is-active' : ''}`}
            onClick={() => setParams({ status: s.value }, { replace: true })}
          >
            {s.label}
          </button>
        ))}
      </div>

      <ErrorNote error={error} />
      {!rows && !error && <Loading />}
      {rows && rows.length === 0 && (
        <Empty>
          <p>No {status} requests.</p>
          {status === 'open' && <Link className="button" to="/charity/requests/new">Post your first request</Link>}
        </Empty>
      )}
      {rows && rows.length > 0 && (
        <ul className="ch-list">
          {rows.map((r) => {
            const pending = r.signups.filter((s) => s.status === 'applied').length;
            const accepted = r.signups.filter((s) => ['accepted', 'attended'].includes(s.status)).length;
            const next = nextShifts(r, 1)[0];
            return (
              <li key={r.id}>
                <Link className="ch-card ch-request-card" to={`/charity/requests/${r.id}`}>
                  <div className="ch-row ch-between">
                    <strong>{r.title}</strong>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="ch-muted ch-small">
                    {labelOf(CATEGORIES, r.category)} · {scheduleSummary(r)}
                  </div>
                  <div className="ch-row ch-small">
                    <span>{next ? `Next: ${fmtShift(next)}` : 'No upcoming shifts'}</span>
                  </div>
                  <div className="ch-row ch-small">
                    <span>👥 {accepted}/{r.slots} confirmed</span>
                    {pending > 0 && <span className="ch-badge ch-badge-warn">{pending} pending</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function RequestsList() {
  return <CharityGate><List /></CharityGate>;
}
