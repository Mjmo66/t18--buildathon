import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Download, ListChecks, Lock, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BADGES, formatDate, formatHours } from './shared';
import './attendance.css';

/** Volunteer: hours, points, badges, printable certificate. */
export function RewardsSummary({ profile }) {
  const profileId = profile?.id;
  const [fresh, setFresh] = useState(null);     // latest profile row (hours/points change on check-in)
  const [earned, setEarned] = useState(new Map());
  const [shifts, setShifts] = useState([]);

  useEffect(() => {
    if (!profileId) return undefined;
    let alive = true;
    (async () => {
      const [p, b, s] = await Promise.all([
        supabase.from('profiles').select('display_name, hours_total, points').eq('id', profileId).maybeSingle(),
        supabase.from('badges').select('code, earned_at').eq('volunteer_id', profileId),
        supabase.from('signups')
          .select('id, shift_at, hours_credited, marked_at, request:requests(title, charity:charities(org_name))')
          .eq('volunteer_id', profileId).eq('status', 'attended').order('shift_at', { ascending: false }),
      ]);
      if (!alive) return;
      if (p.data) setFresh(p.data);
      setEarned(new Map((b.data ?? []).map((x) => [x.code, x.earned_at])));
      setShifts(s.data ?? []);
    })();
    return () => { alive = false; };
  }, [profileId, profile?.hours_total, profile?.points]);

  if (!profile) return null;

  const name = fresh?.display_name ?? profile.display_name;
  const hours = Number(fresh?.hours_total ?? profile.hours_total ?? 0);
  const points = fresh?.points ?? profile.points ?? 0;
  const progress = { hours, shifts: shifts.length };

  function printCertificate() {
    const done = () => {
      document.body.classList.remove('att-printing');
      window.removeEventListener('afterprint', done);
    };
    document.body.classList.add('att-printing');
    window.addEventListener('afterprint', done);
    window.print();
  }

  return (
    <div className="att-rewards">
      <div className="stat-grid att-stat-grid">
        <div className="stat-card">
          <span className="micro-label">Hours</span>
          <Clock className="stat-icon" size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="stat-value">{formatHours(hours)}</span>
          <span className="stat-sub is-success">verified</span>
        </div>
        <div className="stat-card">
          <span className="micro-label">Points</span>
          <Star className="stat-icon" size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="stat-value">{points}</span>
          <span className="stat-sub is-accent">10 per hour</span>
        </div>
        <div className="stat-card">
          <span className="micro-label">Shifts</span>
          <ListChecks className="stat-icon" size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="stat-value">{shifts.length}</span>
          <span className="stat-sub">attended</span>
        </div>
      </div>

      <h3 className="att-h">Badges</h3>
      <ul className="att-badges">
        {BADGES.map((b) => {
          const at = earned.get(b.code);
          const [have, need, unit] = b.progress(progress);
          const BadgeIcon = at ? b.icon : Lock;
          return (
            <li key={b.code} className={`att-badge ${at ? 'att-badge-earned' : 'att-badge-locked'}`}
                aria-label={`${b.label}: ${at ? 'earned' : 'locked'}`}>
              <span className="att-badge-icon" aria-hidden="true"><BadgeIcon size={20} strokeWidth={1.75} /></span>
              <span className="att-badge-label">{b.label}</span>
              <span className="att-badge-meta">
                {at ? formatDate(at) : `${Math.min(Math.round(have * 10) / 10, need)} / ${need} ${unit}`}
              </span>
            </li>
          );
        })}
      </ul>

      <button type="button" className="att-btn att-block" onClick={printCertificate} disabled={hours <= 0}>
        <Download size={18} strokeWidth={1.75} aria-hidden="true" />
        Download certificate
      </button>

      {createPortal(
        <div className="att-certificate-root" aria-hidden="true">
          <div className="att-certificate">
            <div className="att-cert-kicker">Certificate of Volunteering</div>
            <div className="att-cert-intro">This certifies that</div>
            <div className="att-cert-name">{name}</div>
            <div className="att-cert-intro">completed</div>
            <div className="att-cert-hours">{formatHours(hours)} of verified volunteering</div>
            <div className="att-cert-intro">with charities in St Andrews, Scotland.</div>
            <table className="att-cert-table">
              <thead><tr><th>Date</th><th>Shift</th><th>Charity</th><th>Hours</th></tr></thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id}>
                    <td>{formatDate(s.shift_at)}</td>
                    <td>{s.request?.title ?? ''}</td>
                    <td>{s.request?.charity?.org_name ?? ''}</td>
                    <td>{formatHours(s.hours_credited)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="att-cert-foot">
              Hours confirmed by QR check-in or by the charity. Issued {formatDate(new Date().toISOString())}.
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
