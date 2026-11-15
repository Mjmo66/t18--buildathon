import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize2, X } from 'lucide-react';
import { Button } from '../../components/ui/index.js';
import { formatShiftRange } from '../../components/format.js';
import { shortCode } from './shared';
import '../../pages/charity/charity.css';

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
    return <p className="ch-muted">This request has no check-in code.</p>;
  }

  const payload = JSON.stringify({ r: request.id, c: request.checkin_code });
  const shift = request.starts_at ? formatShiftRange(request.starts_at, request.duration_hours) : '';
  const code = shortCode(request.checkin_code);

  const body = (big) => (
    <>
      <h2 className="ch-att-qr-title">Show this to volunteers when they arrive</h2>
      <div className="ch-att-qr-box">
        <QRCodeSVG value={payload} size={big ? 640 : 320} level="M" marginSize={2}
                   style={{ width: '100%', height: 'auto', display: 'block' }}
                   role="img" aria-label={`Check-in code for ${request.title}`} />
      </div>
      <div className="ch-att-qr-code">
        <span className="ch-att-qr-code-label">Or type this code</span>
        <span className="ch-att-qr-digits" aria-label={`Code ${code.split('').join(' ')}`}>{code.length > 4 ? `${code.slice(0, 3)} ${code.slice(3)}` : code}</span>
      </div>
      <div className="ch-att-qr-meta">
        <strong>{request.title}</strong>
        {shift && <span>{shift}</span>}
      </div>
    </>
  );

  return (
    <div className="ch-att-qr">
      {body(false)}
      <Button
        block
        variant="secondary"
        icon={<Maximize2 size={20} aria-hidden="true" />}
        hint="Make the code fill the screen so it is easier to scan."
        onClick={() => setFullScreen(true)}
      >
        Show full screen
      </Button>
      {fullScreen && createPortal(
        <div className="ch-att-qr-full" role="dialog" aria-modal="true" aria-label="Check-in code"
             onClick={() => setFullScreen(false)}>
          <div className="ch-att-qr-full-inner" onClick={(e) => e.stopPropagation()}>
            {body(true)}
            <Button block variant="secondary" icon={<X size={20} aria-hidden="true" />} onClick={() => setFullScreen(false)}>
              Close
            </Button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
