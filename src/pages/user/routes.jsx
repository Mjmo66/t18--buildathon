// Volunteer space routes, mounted under /user by App.jsx. Owned by the volunteer area.
import Discover from './Discover.jsx';
import Preferences from './Preferences.jsx';
import RequestDetail from './RequestDetail.jsx';
import MyShifts from './MyShifts.jsx';
import Profile from './Profile.jsx';

export const userRoutes = [
  { index: true, element: <Discover /> },
  { path: 'requests/:id', element: <RequestDetail /> },
  { path: 'shifts', element: <MyShifts /> },
  { path: 'preferences', element: <Preferences /> },
  { path: 'profile', element: <Profile /> },
];
