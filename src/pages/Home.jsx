import { Button } from '../components/ui/index.js';
import DemoCharityButton from './auth/DemoCharityButton.jsx';

export default function Home() {
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
          <DemoCharityButton />
        </div>
      </div>
    </section>
  );
}
