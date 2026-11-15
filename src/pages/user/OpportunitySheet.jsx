import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, Clock, Dumbbell, HeartHandshake, Hourglass, Loader2, MapPin, X } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { formatDay, formatDuration, formatTime } from '../../components/format.js';
import { LABELS } from './ui.jsx';

function mapsUrl(request) {
  if (request.lat != null && request.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${request.lat},${request.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.address ?? '')}`;
}

/** Bottom sheet with a quick look at one Board opportunity; Accept signs up for its next shift. */
export default function OpportunitySheet({ item, onClose }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => { setBusy(false); setError(null); setDone(false); }, [item?.request.id]);
  useEffect(() => {
    if (!item) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!item) return null;
  const { request, match } = item;
  const category = LABELS.category[request.category] ?? 'Volunteering';

  const accept = async () => {
    if (!user || !match.shiftAt) return;
    setBusy(true); setError(null);
    const { error: err } = await supabase.from('signups').insert({
      request_id: request.id, volunteer_id: user.id, shift_at: match.shiftAt.toISOString(),
    });
    setBusy(false);
    if (err) {
      setError(err.code === '23505' ? "You're already signed up for this date." : `Could not sign up: ${err.message}`);
      return;
    }
    setDone(true);
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="opportunity-sheet-title"
        onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header">
          <h2 id="opportunity-sheet-title">{request.title}</h2>
          <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}><X /></button>
        </div>
        <div className="sheet-body">
          <div className="preview">
            <div className="preview-top">
              <span className={`task-tag task-tag-${request.category ?? 'other'}`}>{category}</span>
            </div>
            <p className="charity-line">
              <HeartHandshake aria-hidden="true" /> {request.charities?.org_name ?? 'Charity'}
            </p>
            <ul className="preview-facts">
              <li><CalendarDays aria-hidden="true" />
                {match.shiftAt ? `${formatDay(match.shiftAt)} · ${formatTime(match.shiftAt)}` : 'No dates yet'}
              </li>
              {request.duration_hours ? <li><Hourglass aria-hidden="true" />{formatDuration(request.duration_hours)}</li> : null}
              {request.address && (
                <li><MapPin aria-hidden="true" />
                  <span>{request.address} · <a href={mapsUrl(request)} target="_blank" rel="noopener noreferrer">Open in Maps</a></span>
                </li>
              )}
              {request.physical_level && <li><Dumbbell aria-hidden="true" />{LABELS.physical[request.physical_level]}</li>}
            </ul>
            {request.description && <p className="preview-description">{request.description}</p>}

            {error && <p className="preview-blocked">{error}</p>}
            {done ? (
              <div className="sheet-actions">
                <p className="sheet-success"><Check aria-hidden="true" /> You’re signed up. They’ll confirm by message.</p>
                <Link to="/user/shifts" className="sheet-btn sheet-btn-primary">See my shifts</Link>
              </div>
            ) : (
              <div className="sheet-actions">
                {match.shiftAt && user && (
                  <button type="button" className="sheet-btn sheet-btn-primary" disabled={busy} onClick={accept}>
                    {busy ? <Loader2 className="sheet-spin" aria-hidden="true" /> : <Check aria-hidden="true" />} Accept
                  </button>
                )}
                <Link to={`/user/requests/${request.id}`} className="sheet-btn sheet-btn-secondary">See full details</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
