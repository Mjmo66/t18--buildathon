import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <section>
      <h1>Welcome</h1>
      <p>Choose your space to get started.</p>
      <div className="card-grid">
        <Link to="/user" className="card card-link">
          <h2>I'm a user</h2>
          <p>Find charities and track your donations.</p>
        </Link>
        <Link to="/charity" className="card card-link">
          <h2>I'm a charity</h2>
          <p>Manage campaigns and see your supporters.</p>
        </Link>
      </div>
    </section>
  );
}
