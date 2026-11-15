import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import Footer from './Footer.jsx';

const defaultLinks = [
  { to: '/', label: 'Home' },
  { to: '/user', label: 'User Space' },
  { to: '/charity', label: 'Charity Space' },
];

export default function Layout({ space, links = defaultLinks }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="layout">
      <Header space={space} onMenuClick={() => setSidebarOpen((open) => !open)} />
      <div className="layout-body">
        <Sidebar links={links} open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
        <main className="content">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}
