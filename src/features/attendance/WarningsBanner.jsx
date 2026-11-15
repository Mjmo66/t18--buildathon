import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatDate, MAX_WARNINGS } from './shared';
import './attendance.css';

/** Volunteer: warnings count and suspension notice; renders nothing when there are none. */
export function WarningsBanner({ profile }) {
  const count = profile?.warnings_count ?? 0;
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    if (!profile?.id || count === 0) { setWarnings([]); return undefined; }
    let alive = true;
    supabase.from('warnings')
      .select('id, reason, created_at, signup:signups(shift_at, request:requests(title))')
      .eq('volunteer_id', profile.id).order('created_at', { ascending: false })
      .then(({ data }) => { if (alive) setWarnings(data ?? []); });
    return () => { alive = false; };
  }, [profile?.id, count]);

  if (!profile || count === 0) return null;
  const suspended = profile.suspended || count >= MAX_WARNINGS;

  return (
    <div className={`att-warnings ${suspended ? 'att-warnings-suspended' : ''}`} role="alert">
      <div className="att-warnings-title">
        {suspended ? 'Account suspended' : `${count} of ${MAX_WARNINGS} warnings`}
      </div>
      {suspended && (
        <div>You have {count} warnings, so you can't sign up for new shifts.</div>
      )}
      {warnings.length > 0 && (
        <ul className="att-warnings-list">
          {warnings.map((w) => (
            <li key={w.id}>
              {w.reason}
              {w.signup?.request?.title && <> · {w.signup.request.title}</>}
              {' · '}{formatDate(w.signup?.shift_at ?? w.created_at)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
