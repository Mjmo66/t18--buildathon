import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { endOfWeek, format, isToday, startOfWeek } from 'date-fns';
import {
  CalendarClock, ChevronRight, ClipboardList, Building2, Clock, Hourglass, MessagesSquare, Plus, UserRoundCheck,
  UserRoundPlus, Users,
} from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { CharityGate, ErrorNote, Loading, VerifiedBadge, VerifyButton } from './components.jsx';
import { fmtHours } from './shared.js';

const ICON = { size: 16, strokeWidth: 1.75, 'aria-hidden': true };

function Dashboard() {
  const { user, charity } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    const [reqRes, filledRes, sigRes] = await Promise.all([
      supabase.from('requests').select('id', { count: 'exact', head: true })
        .eq('charity_id', user.id).eq('status', 'open'),
      supabase.from('requests').select('id', { count: 'exact', head: true })
        .eq('charity_id', user.id).eq('status', 'filled'),
      supabase.from('signups')
        .select('id, status, volunteer_id, shift_at, hours_credited, request_id, requests!inner(charity_id, title)')
        .eq('requests.charity_id', user.id),
    ]);
    const err = reqRes.error ?? filledRes.error ?? sigRes.error;
    if (err) { setError(err); return; }
    const signups = sigRes.data ?? [];
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const inWeek = (s) => { const d = new Date(s.shift_at); return d >= weekStart && d <= weekEnd; };
    const confirmedSignups = signups.filter((s) => ['accepted', 'attended'].includes(s.status));
    const pending = signups.filter((s) => s.status === 'applied');
    const today = confirmedSignups.filter((s) => s.shift_at && isToday(new Date(s.shift_at)));

    // Needs attention: pending applications grouped per request, then today's shifts per request.
    const group = (list, kind) => {
      const map = new Map();
      for (const s of list) {
        const g = map.get(s.request_id) ?? { kind, requestId: s.request_id, title: s.requests?.title ?? 'Request', n: 0, at: s.shift_at };
        g.n += 1;
        if (s.shift_at && (!g.at || s.shift_at < g.at)) g.at = s.shift_at;
        map.set(s.request_id, g);
      }
      return [...map.values()];
    };

    setStats({
      open: reqRes.count ?? 0,
      filled: filledRes.count ?? 0,
      pending: pending.length,
      confirmedWeek: new Set(confirmedSignups.filter(inWeek).map((s) => s.volunteer_id)).size,
      confirmedAll: new Set(confirmedSignups.map((s) => s.volunteer_id)).size,
      attended: signups.filter((s) => s.status === 'attended').length,
      noShows: signups.filter((s) => s.status === 'no_show').length,
      hours: signups.filter((s) => s.status === 'attended')
        .reduce((sum, s) => sum + (Number(s.hours_credited) || 0), 0),
      attention: [...group(pending, 'pending'), ...group(today, 'today')],
    });
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const verified = Boolean(charity.verified_at);

  return (
    <section className="ch-page ch-page-wide">
      <header className="page-head">
        <div className="ch-title">
          <h1>{charity.org_name || 'Overview'}</h1>
          <div className="ch-row">
            <VerifiedBadge verified={verified} />
            {!verified && <VerifyButton className="ch-btn-secondary" />}
          </div>
        </div>
        <Link className="btn btn-primary" to="/charity/requests/new">
          <Plus size={18} strokeWidth={2} aria-hidden="true" />New request
        </Link>
      </header>

      <ErrorNote error={error} />
      {!stats && !error && <Loading />}
      {stats && (
        <>
          <div className="stat-grid">
            <Link className="stat-card" to="/charity/requests?status=open">
              <span className="micro-label">Open requests</span>
              <ClipboardList className="stat-icon" {...ICON} />
              <span className="stat-value">{stats.open}</span>
              <span className="stat-sub is-accent">{stats.filled} filled</span>
            </Link>
            <Link className="stat-card" to="/charity/requests?status=open">
              <span className="micro-label">Pending</span>
              <Hourglass className="stat-icon" {...ICON} />
              <span className="stat-value">{stats.pending}</span>
              <span className={`stat-sub ${stats.pending > 0 ? 'is-warning' : 'is-success'}`}>
                {stats.pending > 0 ? 'to review' : 'all reviewed'}
              </span>
            </Link>
            <div className="stat-card">
              <span className="micro-label">Confirmed</span>
              <Users className="stat-icon" {...ICON} />
              <span className="stat-value">{stats.confirmedWeek}</span>
              <span className="stat-sub is-success">this week · {fmtHours(stats.hours)} h total</span>
            </div>
          </div>

          <div className="list-card">
            <div className="list-card-head">
              <h2>Needs attention</h2>
              <span className={`count ${stats.attention.length > 0 ? 'count-hot' : ''}`}>{stats.attention.length}</span>
            </div>
            {stats.attention.length === 0 ? (
              <p className="list-empty">Nothing waiting.</p>
            ) : (
              stats.attention.map((a) => (
                <Link key={`${a.kind}-${a.requestId}`} className="list-row" to={`/charity/requests/${a.requestId}`}>
                  <span className="list-row-icon">
                    {a.kind === 'pending' ? <UserRoundPlus {...ICON} /> : <CalendarClock {...ICON} />}
                  </span>
                  <span className="list-row-main">
                    <span className="list-row-title">
                      {a.kind === 'pending' ? `Review ${a.n === 1 ? 'application' : 'applications'}` : 'Shift today'} · {a.title}
                    </span>
                  </span>
                  <span className="list-row-meta">
                    {a.kind === 'pending'
                      ? `${a.n} pending`
                      : `${a.at ? format(new Date(a.at), 'HH:mm') : 'Today'} · ${a.n} vol`}
                  </span>
                </Link>
              ))
            )}
          </div>

          <nav className="quick-actions" aria-label="Quick actions">
            <Link className="qa-btn" to="/charity/requests/new"><Plus {...ICON} />New request</Link>
            <Link className="qa-btn" to="/charity/requests"><ClipboardList {...ICON} />All requests</Link>
            <Link className="qa-btn" to="/chat"><MessagesSquare {...ICON} />Chats</Link>
            <Link className="qa-btn" to="/charity/profile"><Building2 {...ICON} />Profile</Link>
          </nav>

          <details className="summary-row">
            <summary>
              <ChevronRight className="chev" {...ICON} />
              <strong>Requests</strong>
              <span className="meta">{stats.open} open · {stats.filled} filled</span>
            </summary>
            <div className="summary-body ch-row">
              <Link className="ch-btn-secondary" to="/charity/requests?status=open">Open</Link>
              <Link className="ch-btn-secondary" to="/charity/requests?status=filled">Filled</Link>
              <Link className="ch-btn-secondary" to="/charity/requests?status=closed">Closed</Link>
            </div>
          </details>
          <details className="summary-row">
            <summary>
              <ChevronRight className="chev" {...ICON} />
              <strong>Volunteers</strong>
              <span className="meta">{stats.confirmedAll} confirmed</span>
            </summary>
            <dl className="summary-body ch-kv">
              <dt><UserRoundCheck {...ICON} />Attended shifts</dt><dd className="mono">{stats.attended}</dd>
              <dt><Clock {...ICON} />Hours delivered</dt><dd className="mono">{fmtHours(stats.hours)} h</dd>
              <dt><Hourglass {...ICON} />No-shows</dt><dd className="mono">{stats.noShows}</dd>
            </dl>
          </details>
        </>
      )}
    </section>
  );
}

export default function CharityDashboard() {
  return <CharityGate><Dashboard /></CharityGate>;
}
