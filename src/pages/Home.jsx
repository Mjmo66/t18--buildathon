import { Link } from 'react-router-dom';
import { CalendarClock, LockKeyhole, MapPin, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/index.js';
import { LogoIcon } from '../components/brand/Logo.jsx';

const POINTS = [
  { icon: MapPin, label: 'Shifts near you' },
  { icon: CalendarClock, label: 'Around your timetable' },
  { icon: ShieldCheck, label: 'Verified hours' },
  { icon: LockKeyhole, label: 'Encrypted chat' },
];

export default function Home() {
  return (
    <section className="landing">
      <div className="landing-hero">
        <LogoIcon size={52} />
        <p className="landing-kicker">St Andrews · Volunteering</p>
        <h1 className="landing-title">
          Give an hour.
          <br />
          <span className="landing-accent">Change a Saturday.</span>
        </h1>
        <div className="landing-actions">
          <Button to="/signup?role=volunteer" block>
            I want to volunteer
          </Button>
          <Button to="/signup?role=charity" variant="secondary" block>
            We're a charity
          </Button>
        </div>
        <p className="landing-signin">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
      <ul className="landing-points" aria-label="Highlights">
        {POINTS.map(({ icon: PointIcon, label }) => (
          <li key={label}>
            <PointIcon size={20} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
