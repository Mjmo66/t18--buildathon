import { useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { publicKeyFingerprint } from '../../lib/chat';
import { Button } from '../../components/ui/index.js';
import Avatar from './Avatar.jsx';

function Fingerprint({ label, name, publicKey }) {
  const fp = publicKey ? publicKeyFingerprint(publicKey) : null;
  const groups = fp && fp !== 'invalid key' ? fp.split(' ') : null;
  return (
    <div className="key-card">
      <div className="key-card-head">
        <Avatar name={name} size={32} />
        <span className="key-card-name">{label}</span>
      </div>
      {groups ? (
        <>
          <div className="key-swatches" aria-hidden="true">
            {groups.map((g, i) => (
              <span key={i} style={{ '--swatch-hue': (parseInt(g, 16) % 360) }} />
            ))}
          </div>
          <code className="key-fingerprint" aria-label={`Security code of ${label}: ${groups.join(' ')}`}>
            {groups.map((g, i) => <span key={i}>{g}</span>)}
          </code>
        </>
      ) : (
        <p className="chat-muted key-missing">{fp === 'invalid key' ? 'Code not readable' : 'Not set up yet'}</p>
      )}
    </div>
  );
}

export default function KeySheet({ open, onClose, myName, myKey, peerName, peerKey }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="sheet-head">
          <span className="sheet-lock" aria-hidden="true"><Lock size={20} strokeWidth={2} /></span>
          <h2 id="key-sheet-title">Compare security codes</h2>
        </div>
        <p className="sheet-lede">When you meet, check that both phones show the same codes.</p>
        <Fingerprint label="You" name={myName} publicKey={myKey} />
        <Fingerprint label={peerName} name={peerName} publicKey={peerKey} />
        <Button ref={closeRef} size="lg" block className="sheet-close" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
