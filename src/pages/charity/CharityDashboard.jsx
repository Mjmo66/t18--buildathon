import { useCallback, useEffect, useState } from 'react';
import { endOfWeek, isToday, startOfWeek } from 'date-fns';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronRight, Clock, Plus, QrCode, UserRoundPlus } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/index.js';
import { formatDayTime, formatDuration, formatTime } from '../../components/format.js';
import { CharityGate, ErrorNote, Loading, VerifiedBadge, VerifyButton } from './components.jsx';

const ICON = { size: 22, strokeWidth: 1.75, 'aria-hidden': true };
const countOf = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

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

    // Coming up: confirmed volunteers per request and shift, soonest first (today's are in To do).
    const ahead = new Map();
    for (const s of confirmedSignups) {
      if (s.status !== 'accepted' || !s.shift_at || isToday(new Date(s.shift_at)) || new Date(s.shift_at) < now) continue;
      const key = `${s.request_id}|${s.shift_at}`;
      const g = ahead.get(key) ?? { requestId: s.request_id, title: s.requests?.title ?? 'Request', at: s.shift_at, n: 0 };
      g.n += 1;
      ahead.set(key, g);
    }

    setStats({
      upcoming: [...ahead.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 4),
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
    <section className="ch-page">
      <header className="ch-title">
        <h1>{charity.org_name || 'Home'}</h1>
        <div className="ch-row">
          <VerifiedBadge verified={verified} />
          {!verified && <VerifyButton variant="secondary" />}
        </div>
      </header>

      <Button
        to="/charity/requests/new"
        size="lg"
        className="ch-main-action"
        icon={<Plus size={22} strokeWidth={2.25} aria-hidden="true" />}
        hint="Ask for volunteers for a task, a date and a place."
      >
        Ask for volunteers
      </Button>

      <ErrorNote error={error} />
      {!stats && !error && <Loading />}
      {stats && (
        <>
          <div className="list-card">
            <div className="list-card-head">
              <h2>To do</h2>
            </div>
            {stats.attention.length === 0 ? (
              <p className="list-empty">Nothing to do right now.</p>
            ) : (
              <ul className="ch-todo">
                {stats.attention.map((a) => (
                  <li key={`${a.kind}-${a.requestId}`} className="list-row ch-todo-row">
                    <span className="list-row-icon">
                      {a.kind === 'pending' ? <UserRoundPlus {...ICON} /> : <CalendarClock {...ICON} />}
                    </span>
                    <span className="list-row-main">
                      <span className="list-row-title">{a.title}</span>
                      <span className="list-row-sub">
                        {a.kind === 'pending'
                          ? `${countOf(a.n, 'volunteer')} waiting for your reply`
                          : `Today${a.at ? ` at ${formatTime(a.at)}` : ''} · ${countOf(a.n, 'volunteer')} coming`}
                      </span>
                    </span>
                    {a.kind === 'pending' ? (
                      <Button
                        variant="secondary"
                        to={`/charity/requests/${a.requestId}`}
                        hint="See who applied and accept or decline them."
                      >
                        Review
                      </Button>
                    ) : (
                      <Button
                        to={`/charity/requests/${a.requestId}?checkin=1`}
                        icon={<QrCode size={20} aria-hidden="true" />}
                        hint="Show a code that volunteers scan when they arrive."
                      >
                        Check in
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <section aria-labelledby="ch-glance">
            <h2 id="ch-glance" className="ch-section-title">At a glance</h2>
            <div className="ch-stats">
              <Link className="ch-stat" to="/charity/requests">
                <span className="ch-stat-num">{stats.open}</span>
                <span className="ch-stat-label">{stats.open === 1 ? 'open request' : 'open requests'}</span>
              </Link>
              <Link className="ch-stat" to="/charity/requests">
                <span className={`ch-stat-num ${stats.pending > 0 ? 'ch-stat-warn' : ''}`}>{stats.pending}</span>
                <span className="ch-stat-label">waiting for your reply</span>
              </Link>
              <div className="ch-stat">
                <span className="ch-stat-num">{stats.confirmedWeek}</span>
                <span className="ch-stat-label">{stats.confirmedWeek === 1 ? 'volunteer' : 'volunteers'} coming this week</span>
              </div>
            </div>
          </section>

          <div className="list-card">
            <div className="list-card-head">
              <h2>Coming up</h2>
            </div>
            {stats.upcoming.length === 0 ? (
              <p className="list-empty">No confirmed volunteers yet.</p>
            ) : (
              <ul>
                {stats.upcoming.map((u) => (
                  <li key={`${u.requestId}-${u.at}`}>
                    <Link className="list-row ch-link-row" to={`/charity/requests/${u.requestId}`}>
                      <span className="list-row-icon"><CalendarClock {...ICON} /></span>
                      <span className="list-row-main">
                        <span className="list-row-title">{u.title}</span>
                        <span className="list-row-sub">{formatDayTime(u.at)} · {countOf(u.n, 'volunteer')} coming</span>
                      </span>
                      <ChevronRight size={24} strokeWidth={2} aria-hidden="true" className="ch-chevron" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {stats.attended > 0 && (
            <div className="ch-sofar">
              <Clock {...ICON} />
              <span>
                <strong>So far:</strong> volunteers gave {formatDuration(stats.hours)} over {countOf(stats.attended, 'shift')}.
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function CharityDashboard() {
  return <CharityGate><Dashboard /></CharityGate>;
}
