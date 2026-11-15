import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';

// User space
import { userLinks } from './pages/user/links.js';
import UserDashboard from './pages/user/UserDashboard.jsx';
import FindCharities from './pages/user/FindCharities.jsx';
import UserProfile from './pages/user/UserProfile.jsx';

// Charity space
import { charityLinks } from './pages/charity/links.js';
import CharityDashboard from './pages/charity/CharityDashboard.jsx';
import Campaigns from './pages/charity/Campaigns.jsx';
import CharityProfile from './pages/charity/CharityProfile.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* User space: /user/... */}
      <Route path="/user" element={<Layout space="User" links={userLinks} />}>
        <Route index element={<UserDashboard />} />
        <Route path="charities" element={<FindCharities />} />
        <Route path="profile" element={<UserProfile />} />
      </Route>

      {/* Charity space: /charity/... */}
      <Route path="/charity" element={<Layout space="Charity" links={charityLinks} />}>
        <Route index element={<CharityDashboard />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="profile" element={<CharityProfile />} />
      </Route>
    </Routes>
  );
}
