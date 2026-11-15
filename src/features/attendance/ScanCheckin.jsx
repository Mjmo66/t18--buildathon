import { lazy, Suspense, useId, useRef, useState } from 'react';
import { Camera, CircleCheck, Keyboard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Alert, Button } from '../../components/ui/index.js';
import { currentUserId, formatHours } from './shared';
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
    return "That code isn't right. Ask the organiser to show it again.";
  }
  if (m.includes('no accepted signup')) {
    return "You don't have a confirmed place on this shift. You may already be checked in, or the charity hasn't confirmed you yet.";
  }
  return `Could not check you in: ${message || 'please try again'}`;
}

/** Manual entry: the 6-character code under the charity's QR, or a pasted payload. */
async function resolveManual(input, userId) {
  const payload = parsePayload(input);
  if (payload) return payload;
  const prefix = input.replace(/[\s-]/g, '').toLowerCase();
  if (prefix.length < 6) return { error: 'Type all 6 characters of the code under the picture.' };
  const { data, error } = await supabase.from('signups')
    .select('request:requests(id, checkin_code)')
    .eq('volunteer_id', userId).eq('status', 'accepted');
  if (error) return { error: friendlyError(error.message) };
  const hit = (data ?? []).map((s) => s.request).find((r) => r?.checkin_code?.startsWith(prefix));
  if (!hit) return { error: "That code doesn't match any of your confirmed shifts." };
  return { request: hit.id, code: hit.checkin_code };
}

/** Volunteer: camera scanner that calls check_in(); onCheckedIn(signup) on success, onDone() on "Done". */
export function ScanCheckin({ onCheckedIn, onDone }) {
  const [phase, setPhase] = useState('scan');   // scan | working | done
  const [cameraError, setCameraError] = useState('');
  const [manual, setManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);   // {signup, title}
  const working = useRef(false);
  const inputId = useId();

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
      const { data: signup, error: err } = await supabase.rpc('check_in',
        { p_request: target.request, p_code: target.code });
      if (err) { setError(friendlyError(err.message)); setPhase('scan'); return; }
      const { data: req } = await supabase.from('requests').select('title')
        .eq('id', signup.request_id).maybeSingle();
      setResult({ signup, title: req?.title ?? '' });
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
      ? "The camera isn't available. Type the code instead."
      : `The camera isn't working (${err?.message ?? 'unknown problem'}). Type the code instead.`);
    setManual(true);
  }

  function done() {
    setResult(null);
    setError('');
    setManualText('');
    setPhase('scan');
    onDone?.();
  }

  if (phase === 'done' && result) {
    const hrs = result.signup.hours_credited;
    return (
      <div className="att-card att-done" role="status">
        <CircleCheck className="att-done-icon" size={48} strokeWidth={2} aria-hidden="true" />
        <h3 className="att-done-title">You're checked in. Thank you!</h3>
        {result.title && <p className="att-done-line">{result.title}</p>}
        {hrs != null && <p className="att-done-line">{formatHours(hrs)} added to your record</p>}
        <Button size="lg" block onClick={done}>Done</Button>
      </div>
    );
  }

  return (
    <div className="att-scan">
      {!manual && (
        <>
          <p className="att-instruction">Point your camera at the code the organiser shows you.</p>
          <div className="att-scanner">
            <Suspense fallback={<div className="att-scanner-placeholder">Starting the camera…</div>}>
              <Scanner
                onScan={onScan}
                onError={onCameraError}
                constraints={{ facingMode: 'environment' }}
                formats={['qr_code']}
                paused={phase === 'working'}
                sound={false}
                components={{ finder: true, torch: false, onOff: false, zoom: false }}
              />
            </Suspense>
          </div>
        </>
      )}

      {phase === 'working' && <p className="att-instruction" role="status">Checking you in…</p>}
      {error && <Alert tone="danger">{error}</Alert>}
      {cameraError && <Alert tone="warning">{cameraError}</Alert>}

      {manual ? (
        <form className="att-manual" onSubmit={(e) => {
          e.preventDefault();
          checkIn((uid) => resolveManual(manualText, uid));
        }}>
          <label className="att-label" htmlFor={inputId}>The code under the picture</label>
          <input id={inputId} className="att-input" value={manualText} autoComplete="off"
                 autoCapitalize="characters" spellCheck={false} maxLength={12} placeholder="3F9A1C"
                 onChange={(e) => setManualText(e.target.value)} />
          <Button type="submit" size="lg" block loading={phase === 'working'}
                  disabled={!manualText.trim()} hint={!manualText.trim() ? 'Type the code first.' : undefined}>
            Check in
          </Button>
          {!cameraError && (
            <Button variant="secondary" block icon={<Camera size={20} aria-hidden="true" />} onClick={() => setManual(false)}>
              Use the camera
            </Button>
          )}
        </form>
      ) : (
        <Button variant="secondary" block icon={<Keyboard size={20} aria-hidden="true" />} onClick={() => setManual(true)}>
          Type the code instead
        </Button>
      )}
    </div>
  );
}
