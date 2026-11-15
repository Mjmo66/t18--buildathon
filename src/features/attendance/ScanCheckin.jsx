import { lazy, Suspense, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { badgeByCode, currentUserId, formatHours, pointsFor } from './shared';
import './attendance.css';

// The scanner pulls in a WASM barcode decoder; load it only when this screen opens.
const Scanner = lazy(() => import('@yudiel/react-qr-scanner').then((m) => ({ default: m.Scanner })));

const CAMERA_BLOCKED = new Set(['permission-denied', 'no-camera', 'in-use', 'insecure-context',
  'unsupported', 'security', 'overconstrained']);

/** Parse {"r": request_id, "c": checkin_code}; null when it isn't a check-in payload. */
function parsePayload(text) {
  try {
    const p = JSON.parse(String(text).trim());
    if (p && typeof p.r === 'string' && typeof p.c === 'string') return { request: p.r, code: p.c };
  } catch { /* not JSON */ }
  return null;
}

function friendlyError(message = '') {
  const m = message.toLowerCase();
  if (m.includes('invalid code') || m.includes('invalid input syntax')) {
    return "This QR code isn't valid. Ask the charity to show it again.";
  }
  if (m.includes('no accepted signup')) {
    return "You don't have an accepted place on this shift. You may already be checked in, or the charity hasn't accepted you yet.";
  }
  return `Check-in failed: ${message || 'unknown error'}`;
}

async function badgeCodes(userId) {
  if (!userId) return new Set();
  const { data } = await supabase.from('badges').select('code').eq('volunteer_id', userId);
  return new Set((data ?? []).map((b) => b.code));
}

/** Manual entry: the 6-character code under the charity's QR, or a pasted payload. */
async function resolveManual(input, userId) {
  const payload = parsePayload(input);
  if (payload) return payload;
  const prefix = input.replace(/[\s-]/g, '').toLowerCase();
  if (prefix.length < 6) return { error: 'Enter the 6-character code shown under the QR.' };
  const { data, error } = await supabase.from('signups')
    .select('request:requests(id, checkin_code)')
    .eq('volunteer_id', userId).eq('status', 'accepted');
  if (error) return { error: friendlyError(error.message) };
  const hit = (data ?? []).map((s) => s.request).find((r) => r?.checkin_code?.startsWith(prefix));
  if (!hit) return { error: "That code doesn't match any shift you're accepted for." };
  return { request: hit.id, code: hit.checkin_code };
}

/** Volunteer: camera scanner that calls check_in(); onCheckedIn(signup) on success. */
export function ScanCheckin({ onCheckedIn }) {
  const [phase, setPhase] = useState('scan');   // scan | working | done
  const [cameraError, setCameraError] = useState('');
  const [manual, setManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);   // {signup, title, newBadges}
  const working = useRef(false);

  async function checkIn(resolve) {
    if (working.current) return;
    working.current = true;
    setPhase('working');
    setError('');
    try {
      const userId = await currentUserId();
      if (!userId) throw new Error('Please sign in first.');
      const target = await resolve(userId);
      if (!target || target.error) {
        setError(target?.error ?? "That isn't a check-in code.");
        setPhase('scan');
        return;
      }
      const before = await badgeCodes(userId);
      const { data: signup, error: err } = await supabase.rpc('check_in',
        { p_request: target.request, p_code: target.code });
      if (err) { setError(friendlyError(err.message)); setPhase('scan'); return; }
      const after = await badgeCodes(userId);
      const { data: req } = await supabase.from('requests').select('title')
        .eq('id', signup.request_id).maybeSingle();
      setResult({
        signup,
        title: req?.title ?? '',
        newBadges: [...after].filter((c) => !before.has(c)).map(badgeByCode),
      });
      setPhase('done');
      onCheckedIn?.(signup);
    } catch (e) {
      setError(friendlyError(e?.message));
      setPhase('scan');
    } finally {
      working.current = false;
    }
  }

  function onScan(codes) {
    const raw = codes?.[0]?.rawValue;
    if (!raw || working.current) return;
    const payload = parsePayload(raw);
    if (!payload) { setError("That isn't a check-in code."); return; }
    checkIn(async () => payload);
  }

  function onCameraError(err) {
    setCameraError(CAMERA_BLOCKED.has(err?.kind)
      ? 'Camera not available. Enter the code shown under the QR instead.'
      : `Camera error: ${err?.message ?? 'unknown'}`);
    setManual(true);
  }

  function reset() {
    setResult(null);
    setError('');
    setManualText('');
    setPhase('scan');
  }

  if (phase === 'done' && result) {
    const hrs = result.signup.hours_credited;
    return (
      <div className="att-card att-celebrate" role="status">
        <div className="att-celebrate-icon" aria-hidden="true">🎉</div>
        <h3 className="att-h">You're checked in!</h3>
        {result.title && <div className="att-muted">{result.title}</div>}
        <div className="att-stats">
          <div className="att-stat"><strong>+{formatHours(hrs)}</strong><span>verified</span></div>
          <div className="att-stat"><strong>+{pointsFor(hrs)}</strong><span>points</span></div>
        </div>
        {result.newBadges.length > 0 && (
          <div className="att-new-badges">
            {result.newBadges.map((b) => (
              <div key={b.code} className="att-badge att-badge-earned att-badge-new">
                <span className="att-badge-icon" aria-hidden="true">{b.icon}</span>
                <span>New badge: {b.label}</span>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="att-btn att-block" onClick={reset}>Done</button>
      </div>
    );
  }

  return (
    <div className="att-card att-scan">
      {!manual && (
        <div className="att-scanner">
          <Suspense fallback={<div className="att-scanner-placeholder">Starting camera…</div>}>
            <Scanner
              onScan={onScan}
              onError={onCameraError}
              constraints={{ facingMode: 'environment' }}
              formats={['qr_code']}
              paused={phase === 'working'}
              sound={false}
              components={{ finder: true, torch: true }}
            />
          </Suspense>
        </div>
      )}

      {phase === 'working' && <div className="att-muted" role="status">Checking in…</div>}
      {error && <div className="att-error" role="alert">{error}</div>}
      {cameraError && <div className="att-muted att-small">{cameraError}</div>}

      {manual ? (
        <form className="att-manual" onSubmit={(e) => {
          e.preventDefault();
          checkIn((uid) => resolveManual(manualText, uid));
        }}>
          <label className="att-label" htmlFor="att-manual-code">Check-in code</label>
          <input id="att-manual-code" className="att-input" value={manualText} autoComplete="off"
                 autoCapitalize="characters" placeholder="e.g. 3F9A1C"
                 onChange={(e) => setManualText(e.target.value)} />
          <button type="submit" className="att-btn att-btn-primary att-block"
                  disabled={phase === 'working' || !manualText.trim()}>Check in</button>
          {!cameraError && (
            <button type="button" className="att-link" onClick={() => setManual(false)}>Use camera</button>
          )}
        </form>
      ) : (
        <button type="button" className="att-link" onClick={() => setManual(true)}>Enter code instead</button>
      )}
    </div>
  );
}
