import React, { useContext, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from 'semantic-ui-react';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../context/User';
import { isAdmin } from '../helpers';

const navItems = [
  { name: 'header.dashboard', to: '/dashboard', icon: 'chart bar' },
  { name: 'header.channel', to: '/channel', icon: 'cloud', admin: true },
  { name: 'header.token', to: '/token', icon: 'key' },
  { name: 'header.log', to: '/log', icon: 'file alternate outline' },
  { name: 'header.health', to: '/channel-health', icon: 'heartbeat', admin: true },
  { name: 'header.user', to: '/user', icon: 'users', admin: true },
  { name: 'header.apidocs', to: '/api-docs', icon: 'book' },
  { name: 'header.setting', to: '/setting', icon: 'setting' },
];

const Sidebar = ({ collapsed, setCollapsed }) => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const visible = navItems.filter((item) => !(item.admin && !isAdmin()));

  // Don't show sidebar on auth pages or if not logged in
  const authPaths = ['/login', '/register', '/reset', '/oauth'];
  const isAuthPage = authPaths.some((p) => location.pathname.startsWith(p));
  if (isAuthPage || !userState.user) return null;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className='sidebar-backdrop'
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile menu toggle */}
      <button
        className='sidebar-mobile-toggle'
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label='Toggle navigation'
      >
        <Icon name={mobileOpen ? 'close' : 'bars'} />
      </button>

      <aside className={`ln-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Logo */}
        <div className='ln-sidebar-logo'>
          <Link to='/' className='ln-sidebar-brand'>
            <div className='ln-sidebar-brand-icon'>L</div>
            <span className='ln-sidebar-brand-text'>LiteNova</span>
          </Link>
        </div>

        {/* Nav Items */}
        <nav className='ln-sidebar-nav'>
          {visible.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`ln-sidebar-item ${isActive(item.to) ? 'active' : ''}`}
            >
              <Icon name={item.icon} />
              <span>{t(item.name)}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className='ln-sidebar-footer'>
          <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
            v1.0.0
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
