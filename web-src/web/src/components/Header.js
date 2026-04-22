import React, { useContext, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { UserContext } from '../context/User';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Container,
  Dropdown,
  Icon,
  Menu,
  Segment,
} from 'semantic-ui-react';
import {
  API,
  isAdmin,
  isMobile,
  showSuccess,
} from '../helpers';
import '../index.css';

const headerButtons = [
  { name: 'header.dashboard', to: '/dashboard', icon: 'chart bar' },
  { name: 'header.channel', to: '/channel', icon: 'cloud', admin: true },
  { name: 'header.token', to: '/token', icon: 'key' },
  { name: 'header.log', to: '/log', icon: 'file alternate outline' },
  { name: 'header.health', to: '/channel-health', icon: 'heartbeat', admin: true },
  { name: 'header.user', to: '/user', icon: 'users', admin: true },
  { name: 'header.setting', to: '/setting', icon: 'setting' },
];

const LiteNovaLogo = () => (
  <div className='litenova-nav-logo'>
    <div className='litenova-nav-logo-icon'>L</div>
    <span className='litenova-nav-logo-text'>LiteNova</span>
  </div>
);

const Header = () => {
  const { t, i18n } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [showSidebar, setShowSidebar] = useState(false);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  async function logout() {
    setShowSidebar(false);
    await API.get('/api/user/logout');
    showSuccess('注销成功!');
    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    navigate('/login');
  }

  const visibleButtons = headerButtons.filter(
    (btn) => !(btn.admin && !isAdmin())
  );

  const languageOptions = [
    { key: 'zh', text: '中文', value: 'zh' },
    { key: 'en', text: 'English', value: 'en' },
  ];

  // Mobile
  if (isMobile()) {
    return (
      <>
        <Menu borderless size='large' fixed='top' style={{ height: 52, zIndex: 1000 }}>
          <Container style={{ width: '100%', maxWidth: '100%', padding: '0 12px' }}>
            <Menu.Item as={Link} to='/' style={{ padding: '0 4px' }}>
              <LiteNovaLogo />
            </Menu.Item>
            <Menu.Menu position='right'>
              {userState.user ? (
                <Menu.Item onClick={() => setShowSidebar(!showSidebar)}>
                  <Icon name={showSidebar ? 'close' : 'bars'} />
                </Menu.Item>
              ) : (
                <Menu.Item as={Link} to='/login' style={{ color: '#6366f1', fontWeight: 600 }}>
                  {t('header.login')}
                </Menu.Item>
              )}
            </Menu.Menu>
          </Container>
        </Menu>
        {showSidebar && (
          <Segment style={{ position: 'fixed', top: 52, left: 0, right: 0, zIndex: 999, margin: 0, borderRadius: 0, borderTop: 0, boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
            <Menu secondary vertical style={{ width: '100%', margin: 0 }}>
              {visibleButtons.map((btn) => (
                <Menu.Item
                  key={btn.name}
                  active={isActive(btn.to)}
                  onClick={() => { navigate(btn.to); setShowSidebar(false); }}
                  style={{ fontSize: 15, padding: '12px 16px' }}
                >
                  <Icon name={btn.icon} style={{ marginRight: 8 }} />
                  {t(btn.name)}
                </Menu.Item>
              ))}
              <Menu.Item onClick={logout} style={{ color: '#ef4444', fontSize: 15, padding: '12px 16px' }}>
                <Icon name='sign-out' style={{ marginRight: 8 }} />
                {t('header.logout')}
              </Menu.Item>
            </Menu>
          </Segment>
        )}
      </>
    );
  }

  // Desktop
  return (
    <Menu borderless fixed='top' style={{
      borderTop: 'none', border: 'none', zIndex: 1000,
      boxShadow: '0 1px 3px rgba(99, 102, 241, 0.08)',
      background: 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(12px)',
    }}>
      <Container style={{ width: '100%', maxWidth: 1200, padding: '0 20px' }}>
        <Menu.Item as={Link} to='/' style={{ padding: '0 12px 0 0' }}>
          <LiteNovaLogo />
        </Menu.Item>

        {userState.user && visibleButtons.map((btn) => (
          <Menu.Item
            key={btn.name}
            as={Link}
            to={btn.to}
            className={isActive(btn.to) ? 'nav-item-active' : ''}
            style={{
              fontSize: 14, fontWeight: isActive(btn.to) ? 600 : 400,
              color: isActive(btn.to) ? '#6366f1' : '#64748b',
              padding: '8px 12px', margin: '0 2px',
            }}
          >
            <Icon name={btn.icon} style={{ marginRight: 4, fontSize: 13 }} />
            {t(btn.name)}
          </Menu.Item>
        ))}

        <Menu.Menu position='right'>
          <Dropdown
            item
            trigger={<Icon name='language' style={{ margin: 0, fontSize: 16 }} />}
            options={languageOptions}
            value={i18n.language}
            onChange={(_, { value }) => i18n.changeLanguage(value)}
            style={{ color: '#64748b', padding: '0 8px' }}
          />
          {userState.user ? (
            <Dropdown
              text={userState.user.username}
              pointing
              className='link item'
              style={{ fontSize: 14, color: '#64748b' }}
            >
              <Dropdown.Menu>
                <Dropdown.Item as={Link} to='/user/edit' icon='user' text='个人设置' />
                <Dropdown.Item as={Link} to='/api-docs' icon='book' text='API 文档' />
                <Dropdown.Divider />
                <Dropdown.Item onClick={logout} icon='sign-out' text={t('header.logout')} style={{ color: '#ef4444' }} />
              </Dropdown.Menu>
            </Dropdown>
          ) : (
            <>
              <Menu.Item as={Link} to='/login' style={{ fontSize: 14, fontWeight: 500, color: '#6366f1' }}>
                {t('header.login')}
              </Menu.Item>
              <Menu.Item>
                <Button as={Link} to='/register' primary size='small' style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  borderRadius: 8, fontSize: 13,
                }}>
                  {t('header.register')}
                </Button>
              </Menu.Item>
            </>
          )}
        </Menu.Menu>
      </Container>
    </Menu>
  );
};

export default Header;
