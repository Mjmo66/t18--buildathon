import { Link } from 'react-router-dom';
import { Button } from '../components/ui/index.js';

export default function Home() {
  return (
    <section className="landing">
      <div className="landing-hero">
        <p className="landing-kicker">St Andrews</p>
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
        <li><span aria-hidden="true">📍</span> Shifts near you</li>
        <li><span aria-hidden="true">🗓️</span> Around your timetable</li>
        <li><span aria-hidden="true">⭐</span> Verified hours</li>
        <li><span aria-hidden="true">🔒</span> Encrypted chat</li>
      </ul>
    </section>
  );
}
