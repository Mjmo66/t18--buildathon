import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/index.js';
import { BADGES, formatDate, formatHours } from './shared';
import './attendance.css';

/** Volunteer: hours and shifts in one line, earned badges, printable certificate. */
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
  function printCertificate() {
    const done = () => {
      document.body.classList.remove('att-printing');
      window.removeEventListener('afterprint', done);
    };
    document.body.classList.add('att-printing');
    window.addEventListener('afterprint', done);
    window.print();
  }

  const earnedBadges = BADGES.filter((b) => earned.has(b.code));
  const shiftCount = shifts.length;

  return (
    <div className="att-rewards">
      <p className="att-summary">
        <strong>{formatHours(hours)}</strong> given · <strong>{shiftCount}</strong> {shiftCount === 1 ? 'shift' : 'shifts'}
      </p>

      {earnedBadges.length > 0 && (
        <>
          <h3 className="att-h">Your badges</h3>
          <ul className="att-badges">
            {earnedBadges.map((b) => (
              <li key={b.code} className="att-badge">
                <span className="att-badge-icon" aria-hidden="true"><b.icon size={22} strokeWidth={1.75} /></span>
                <span className="att-badge-text">
                  <span className="att-badge-label">{b.label}</span>
                  <span className="att-badge-meta">Earned {formatDate(earned.get(b.code))}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Button variant="secondary" size="lg" block icon={<Download size={22} aria-hidden="true" />} onClick={printCertificate}
        disabled={hours <= 0}
        hint={hours <= 0 ? 'You can print it after your first shift.' : 'Print a certificate of your hours, or save it as a PDF.'}>
        Download certificate
      </Button>

      {createPortal(
        <div className="att-certificate-root" aria-hidden="true">
          <div className="att-certificate">
            <div className="att-cert-kicker">Certificate of Volunteering</div>
            <div className="att-cert-intro">This certifies that</div>
            <div className="att-cert-name">{name}</div>
            <div className="att-cert-intro">completed</div>
            <div className="att-cert-hours">{formatHours(hours)} of volunteering</div>
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
