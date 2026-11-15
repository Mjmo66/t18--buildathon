// Charity space routes, mounted under /charity by App.jsx. Owned by the charity area.
// Each entry: { path, element } (path relative to /charity; use index: true for the default page).
import CharityDashboard from './CharityDashboard.jsx';
import RequestsList from './RequestsList.jsx';
import RequestNew from './RequestNew.jsx';
import RequestDetail from './RequestDetail.jsx';
import CharityProfile from './CharityProfile.jsx';

export const charityRoutes = [
  { index: true, element: <CharityDashboard /> },
  { path: 'requests', element: <RequestsList /> },
  { path: 'requests/new', element: <RequestNew /> },
  { path: 'requests/:id', element: <RequestDetail /> },
  { path: 'profile', element: <CharityProfile /> },
];
