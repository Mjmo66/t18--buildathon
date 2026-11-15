import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Plus, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/index.js';
import { formatShiftRange } from '../../components/format.js';
import { CharityGate, Empty, ErrorNote, Loading, StatusPill } from './components.jsx';
import { REQUEST_STATUSES, nextShifts, requestFacts, scheduleSummary, volunteers } from './shared.js';

const ICON = { size: 20, strokeWidth: 1.75, 'aria-hidden': true };

function List() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  // Open requests by default; "finished" (filled + closed) behind one link. Old ?status= links still work.
  const legacy = params.get('status');
  const finished = params.get('show') === 'finished' || (legacy && legacy !== 'open' && REQUEST_STATUSES.some((s) => s.value === legacy));
  const statuses = finished ? ['filled', 'closed'] : ['open'];
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    supabase.from('requests')
      .select('*, signups(status)')
      .eq('charity_id', user.id)
      .in('status', statuses)
      .order('starts_at', { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err); else setRows(data ?? []);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, finished]);

  return (
    <section className="ch-page">
      {finished && (
        <Link className="back-link" to="/charity/requests">
          <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />Back to open requests
        </Link>
      )}
      <header className="page-head">
        <h1>{finished ? 'Finished requests' : 'My requests'}</h1>
      </header>

      {!finished && (
        <Button
          to="/charity/requests/new"
          size="lg"
          className="ch-main-action"
          icon={<Plus size={22} strokeWidth={2.25} aria-hidden="true" />}
          hint="Ask for volunteers for a task, a date and a place."
        >
          Ask for volunteers
        </Button>
      )}

      <ErrorNote error={error} />
      {!rows && !error && <Loading />}
      {rows && rows.length === 0 && (
        <Empty>
          <p>{finished ? 'No finished requests yet.' : 'You have no open requests.'}</p>
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
                  <div className="ch-row ch-between ch-request-top">
                    <strong className="ch-request-title">{r.title}</strong>
                    {finished && <StatusPill status={r.status} />}
                  </div>
                  <span className="ch-meta-item">
                    <CalendarDays {...ICON} />
                    {next ? formatShiftRange(next, r.duration_hours) : 'No shifts coming up'}
                  </span>
                  {r.schedule_type === 'recurring' && <span className="ch-muted">{scheduleSummary(r)}</span>}
                  <span className="ch-meta-item">
                    <Users {...ICON} />
                    {requestFacts(r, accepted)}
                  </span>
                  {pending > 0 && (
                    <span className="ch-badge ch-badge-warn">{volunteers(pending)} waiting for your reply</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {!finished && (
        <Link className="ch-text-link" to="/charity/requests?show=finished">See finished requests</Link>
      )}
    </section>
  );
}

export default function RequestsList() {
  return <CharityGate><List /></CharityGate>;
}
