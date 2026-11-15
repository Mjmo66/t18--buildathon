// Volunteer space routes, mounted under /user by App.jsx. Owned by the volunteer area.
import UserDashboard from './UserDashboard.jsx';
import FindCharities from './FindCharities.jsx';
import UserProfile from './UserProfile.jsx';

export const userRoutes = [
  { index: true, element: <UserDashboard /> },
  { path: 'charities', element: <FindCharities /> },
  { path: 'profile', element: <UserProfile /> },
];
