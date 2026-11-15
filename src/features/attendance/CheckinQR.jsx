import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize2 } from 'lucide-react';
import { formatShift, shortCode } from './shared';
import './attendance.css';

/** Charity: QR code a volunteer scans to check in. Payload JSON {"r": request.id, "c": request.checkin_code}. */
export function CheckinQR({ request }) {
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    if (!fullScreen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setFullScreen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullScreen]);

  if (!request?.id || !request?.checkin_code) {
    return <div className="att-card att-muted">No check-in code for this request.</div>;
  }

  const payload = JSON.stringify({ r: request.id, c: request.checkin_code });
  const shift = formatShift(request.starts_at, request.duration_hours);
  const code = shortCode(request.checkin_code);

  const body = (big) => (
    <>
      <div className="att-qr-box">
        <QRCodeSVG value={payload} size={big ? 512 : 256} level="M" marginSize={2}
                   style={{ width: '100%', height: 'auto', display: 'block' }}
                   title={`Check-in QR for ${request.title}`} />
      </div>
      <div className="att-qr-title">{request.title}</div>
      {shift && <div className="att-muted">{shift}</div>}
      <div className="att-qr-code" aria-label="Manual check-in code"><span className="micro-label">Code</span> {code}</div>
    </>
  );

  return (
    <div className="att-card att-qr">
      {body(false)}
      <button type="button" className="att-btn att-btn-primary att-block" onClick={() => setFullScreen(true)}>
        <Maximize2 size={18} strokeWidth={1.75} aria-hidden="true" />
        Show full screen
      </button>
      {fullScreen && createPortal(
        <div className="att-qr-full" role="dialog" aria-modal="true" aria-label="Check-in QR code"
             onClick={() => setFullScreen(false)}>
          <div className="att-qr-full-inner" onClick={(e) => e.stopPropagation()}>
            {body(true)}
            <button type="button" className="att-btn att-block" onClick={() => setFullScreen(false)}>Close</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
