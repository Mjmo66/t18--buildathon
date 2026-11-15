import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Heart } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { SIGNUP_SELECT } from './data.js';
import { Loading } from './ui.jsx';
import './commitments.css';

/** One thank-you note per attended shift, newest first. */
export default function ThankYou() {
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    if (!user) { setNotes([]); return undefined; }
    supabase.from('signups').select(SIGNUP_SELECT)
      .eq('volunteer_id', user.id).eq('status', 'attended').order('shift_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!live) return;
        if (err) setError(err.message);
        setNotes(data ?? []);
      });
    return () => { live = false; };
  }, [user]);

  const first = profile?.display_name?.trim().split(/\s+/)[0] || 'Friend';

  return (
    <div className="lv">
      <div className="phone-padding">
        <div className="thanks-head">
          <h2>A little thank you</h2>
          <Heart aria-hidden="true" />
        </div>
        {error && <p className="commitment-alert is-danger" role="alert">{error}</p>}
        {!notes ? <Loading /> : notes.length === 0 ? (
          <div className="empty-state">
            <Heart aria-hidden="true" className="thanks-empty-icon" />
            <p>Your thank-you notes will appear here after your first shift.</p>
          </div>
        ) : (
          <ul className="thanks-list">
            {notes.map((s) => {
              const title = s.requests?.title ?? 'a shift';
              return (
                <li key={s.id} className="thanks-note">
                  <Heart aria-hidden="true" />
                  <div>
                    <p className="thanks-text">
                      {first}, thank you for helping with {title}. Your time made a real difference to people in St Andrews.
                    </p>
                    <p className="thanks-meta">
                      <strong>{s.requests?.charities?.org_name ?? 'Your charity'}</strong>
                      <span>{title}</span>
                      <span>{format(new Date(s.shift_at), 'd MMMM')}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
