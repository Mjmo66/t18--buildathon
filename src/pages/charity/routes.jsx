// Charity space routes, mounted under /charity by App.jsx. Owned by the charity area.
// Each entry: { path, element } (path relative to /charity; use index: true for the default page).
import CharityDashboard from './CharityDashboard.jsx';
import Campaigns from './Campaigns.jsx';
import CharityProfile from './CharityProfile.jsx';

export const charityRoutes = [
  { index: true, element: <CharityDashboard /> },
  { path: 'campaigns', element: <Campaigns /> },
  { path: 'profile', element: <CharityProfile /> },
];
