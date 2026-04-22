import React, { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon, Dropdown, Button } from 'semantic-ui-react';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../context/User';
import { API, showSuccess } from '../helpers';

const pageTitleMap = {
  '/': '首页',
  '/dashboard': '仪表盘',
  '/channel': '供应商',
  '/channel/add': '添加连接',
  '/token': 'API 密钥',
  '/log': '调用日志',
  '/channel-health': '健康监控',
  '/user': '用户管理',
  '/setting': '系统设置',
  '/topup': '购买额度',
  '/api-docs': 'API 文档',
  '/about': '关于',
};

const getPageTitle = (pathname) => {
  if (pageTitleMap[pathname]) return pageTitleMap[pathname];
  // Prefix match
  for (const [path, title] of Object.entries(pageTitleMap)) {
    if (path !== '/' && pathname.startsWith(path)) return title;
  }
  return '';
};

const Topbar = () => {
  const { t, i18n } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();

  const authPaths = ['/login', '/register', '/reset', '/oauth'];
  const isAuthPage = authPaths.some((p) => location.pathname.startsWith(p));
  if (isAuthPage) return null;

  const isLandingPage = location.pathname === '/' && !userState.user;

  async function logout() {
    await API.get('/api/user/logout');
    showSuccess('注销成功!');
    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    navigate('/login');
  }

  const languageOptions = [
    { key: 'zh', text: '中文', value: 'zh' },
    { key: 'en', text: 'English', value: 'en' },
  ];

  const pageTitle = getPageTitle(location.pathname);

  // Landing page: full-width topbar with Logo + Login/Register
  if (isLandingPage) {
    return (
      <header className='ln-topbar ln-topbar-landing'>
        <Link to='/' className='ln-topbar-brand'>
          <div className='ln-topbar-brand-icon'>L</div>
          <span className='ln-topbar-brand-text'>LiteNova</span>
        </Link>
        <div className='ln-topbar-actions'>
          <Dropdown
            trigger={<Icon name='language' style={{ margin: 0, fontSize: 16, color: '#64748b' }} />}
            options={languageOptions}
            value={i18n.language}
            onChange={(_, { value }) => i18n.changeLanguage(value)}
            icon={null}
            style={{ marginRight: 16 }}
          />
          <Link to='/login' style={{ color: '#6366f1', fontSize: 14, fontWeight: 500, marginRight: 12 }}>
            {t('header.login')}
          </Link>
          <Button as={Link} to='/register' primary size='small' style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: 8, fontSize: 13,
          }}>
            {t('header.register')}
          </Button>
        </div>
      </header>
    );
  }

  // Authenticated: topbar with page title + user menu (sidebar shows nav)
  return (
    <header className='ln-topbar ln-topbar-app'>
      <div className='ln-topbar-title'>{pageTitle}</div>
      <div className='ln-topbar-actions'>
        <Dropdown
          trigger={<Icon name='language' style={{ margin: 0, fontSize: 16, color: '#64748b' }} />}
          options={languageOptions}
          value={i18n.language}
          onChange={(_, { value }) => i18n.changeLanguage(value)}
          icon={null}
          style={{ marginRight: 20 }}
        />
        {userState.user && (
          <Dropdown
            trigger={
              <div className='ln-topbar-user'>
                <div className='ln-topbar-avatar'>
                  {userState.user.username.charAt(0).toUpperCase()}
                </div>
                <span className='ln-topbar-username'>{userState.user.username}</span>
                <Icon name='chevron down' style={{ fontSize: 11, marginLeft: 4, color: '#64748b' }} />
              </div>
            }
            icon={null}
            pointing='top right'
          >
            <Dropdown.Menu>
              <Dropdown.Item as={Link} to='/user/edit' icon='user' text='个人设置' />
              <Dropdown.Item as={Link} to='/topup' icon='credit card' text='购买额度' />
              <Dropdown.Divider />
              <Dropdown.Item onClick={logout} icon='sign-out' text={t('header.logout')} style={{ color: '#ef4444' }} />
            </Dropdown.Menu>
          </Dropdown>
        )}
      </div>
    </header>
  );
};

export default Topbar;
