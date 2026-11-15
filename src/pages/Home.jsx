import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, HeartHandshake } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { installDemoKey } from '../lib/crypto';
import { Alert, Button } from '../components/ui/index.js';

// Demo accounts from scripts/seed.mjs, for the presentation: one tap signs in as a seeded user.
const DEMO = {
  volunteer: { email: 'isla@demo.kindred.uk', to: '/user' },
  charity: { email: 'beachguardians@demo.kindred.uk', to: '/charity' },
};
const DEMO_PASSWORD = 'demo-pass-2026';

export default function Home() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const tryDemo = async (role) => {
    setBusy(role);
    setError(null);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: DEMO[role].email, password: DEMO_PASSWORD });
    setBusy(null);
    if (err) { setError(err.message); return; }
    if (data.user) installDemoKey(data.user.id, data.user.email);
    navigate(DEMO[role].to, { replace: true });
  };

  return (
    <section className="landing">
      <div className="landing-hero">
        <h1 className="landing-title">
          Give an hour.
          <br />
          <span className="landing-accent">Change a Saturday.</span>
        </h1>
        <div className="landing-actions">
          <Button to="/signup?role=volunteer" size="lg" block>
            I want to volunteer
          </Button>
          <Button to="/signup?role=charity" variant="secondary" size="lg" block>
            We're a charity
          </Button>
          <Button to="/login" variant="secondary" block>
            I already have an account
          </Button>
        </div>
      </div>

      <div className="landing-demo" aria-labelledby="landing-demo-title">
        <h2 id="landing-demo-title">Try the demo</h2>
        <div className="landing-demo-buttons">
          <Button variant="secondary" block loading={busy === 'volunteer'} disabled={!!busy}
            icon={<HeartHandshake size={20} aria-hidden="true" />} onClick={() => tryDemo('volunteer')}>
            Demo volunteer
          </Button>
          <Button variant="secondary" block loading={busy === 'charity'} disabled={!!busy}
            icon={<Building2 size={20} aria-hidden="true" />} onClick={() => tryDemo('charity')}>
            Demo charity
          </Button>
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </section>
  );
}
