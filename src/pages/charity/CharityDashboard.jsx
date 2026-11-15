import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { endOfWeek, startOfWeek } from 'date-fns';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { CharityGate, ErrorNote, Loading, VerifiedBadge, VerifyButton } from './components.jsx';
import { fmtHours } from './shared.js';

function Dashboard() {
  const { user, charity } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    const [reqRes, sigRes] = await Promise.all([
      supabase.from('requests').select('id', { count: 'exact', head: true })
        .eq('charity_id', user.id).eq('status', 'open'),
      supabase.from('signups')
        .select('id, status, volunteer_id, shift_at, hours_credited, requests!inner(charity_id)')
        .eq('requests.charity_id', user.id),
    ]);
    if (reqRes.error || sigRes.error) { setError(reqRes.error ?? sigRes.error); return; }
    const signups = sigRes.data ?? [];
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const confirmed = new Set(
      signups
        .filter((s) => ['accepted', 'attended'].includes(s.status))
        .filter((s) => { const d = new Date(s.shift_at); return d >= weekStart && d <= weekEnd; })
        .map((s) => s.volunteer_id),
    );
    setStats({
      open: reqRes.count ?? 0,
      pending: signups.filter((s) => s.status === 'applied').length,
      confirmedWeek: confirmed.size,
      hours: signups.filter((s) => s.status === 'attended')
        .reduce((sum, s) => sum + (Number(s.hours_credited) || 0), 0),
    });
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const verified = Boolean(charity.verified_at);

  return (
    <section className="ch-page">
      <header className="ch-head">
        <div>
          <h1>{charity.org_name}</h1>
          <div className="ch-row">
            <VerifiedBadge verified={verified} />
            {!verified && <VerifyButton className="ch-btn-secondary" />}
          </div>
        </div>
        <Link className="button" to="/charity/requests/new">+ New request</Link>
      </header>

      <ErrorNote error={error} />
      {!stats && !error && <Loading />}
      {stats && (
        <div className="ch-stats">
          <Link className="ch-stat" to="/charity/requests?status=open">
            <strong>{stats.open}</strong><span>Open requests</span>
          </Link>
          <Link className="ch-stat" to="/charity/requests?status=open">
            <strong>{stats.pending}</strong><span>Pending applications</span>
          </Link>
          <div className="ch-stat">
            <strong>{stats.confirmedWeek}</strong><span>Volunteers confirmed this week</span>
          </div>
          <div className="ch-stat">
            <strong>{fmtHours(stats.hours)}</strong><span>Hours delivered</span>
          </div>
        </div>
      )}
    </section>
  );
}

export default function CharityDashboard() {
  return <CharityGate><Dashboard /></CharityGate>;
}
