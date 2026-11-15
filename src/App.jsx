import { Routes, Route, Navigate } from 'react-router-dom';
import Layout, { PublicLayout } from './components/Layout.jsx';
import { RequireAuth, PublicOnly } from './components/RequireAuth.jsx';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';
import Login from './pages/auth/Login.jsx';
import Signup from './pages/auth/Signup.jsx';
import CharityDetails from './pages/auth/CharityDetails.jsx';
import { charityRoutes } from './pages/charity/routes.jsx';
import { userRoutes } from './pages/user/routes.jsx';
import { chatRoutes } from './pages/chat/routes.jsx';

// Turn an area's route array ({ index, path, element }) into <Route>s.
function mount(routes, prefix) {
  return routes.map((r, i) =>
    r.index ? (
      <Route key={`${prefix}-index`} index element={r.element} />
    ) : (
      <Route key={`${prefix}-${r.path ?? i}`} path={r.path} element={r.element} />
    ),
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<PublicOnly><Home /></PublicOnly>} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
        <Route path="/charity-details" element={<RequireAuth role="charity"><CharityDetails /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Charity space: /charity/... */}
      <Route path="/charity" element={<RequireAuth role="charity" needsCharity><Layout /></RequireAuth>}>
        {mount(charityRoutes, 'charity')}
        <Route path="*" element={<Navigate to="/charity" replace />} />
      </Route>

      {/* Volunteer space: /user/... */}
      <Route path="/user" element={<RequireAuth role="volunteer"><Layout /></RequireAuth>}>
        {mount(userRoutes, 'user')}
        <Route path="*" element={<Navigate to="/user" replace />} />
      </Route>

      {/* Chat: any signed-in user (charities need their details first) */}
      <Route path="/chat" element={<RequireAuth needsCharity><Layout /></RequireAuth>}>
        {mount(chatRoutes, 'chat')}
      </Route>
    </Routes>
  );
}
