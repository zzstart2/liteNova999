import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

// Header Buttons
let headerButtons = [
  {
    name: 'header.channel',
    to: '/channel',
    icon: 'sitemap',
    admin: true,
  },
  {
    name: 'header.token',
    to: '/token',
    icon: 'key',
  },
  {
    name: 'header.redemption',
    to: '/redemption',
    icon: 'dollar sign',
    admin: true,
  },
  {
    name: 'header.topup',
    to: '/topup',
    icon: 'cart',
  },
  {
    name: 'header.user',
    to: '/user',
    icon: 'user',
    admin: true,
  },
  {
    name: 'header.dashboard',
    to: '/dashboard',
    icon: 'chart bar',
  },
  {
    name: 'header.log',
    to: '/log',
    icon: 'book',
  },
  {
    name: 'header.health',
    to: '/channel-health',
    icon: 'heartbeat',
    admin: true,
  },
  {
    name: 'header.apidocs',
    to: '/api-docs',
    icon: 'book',
  },
  {
    name: 'header.setting',
    to: '/setting',
    icon: 'setting',
  },
  {
    name: 'header.about',
    to: '/about',
    icon: 'info circle',
  },
];

if (localStorage.getItem('chat_link')) {
  headerButtons.splice(1, 0, {
    name: 'header.chat',
    to: '/chat',
    icon: 'comments',
  });
}

const LiteNovaLogo = ({ size = 'nav' }) => {
  const isNav = size === 'nav';
  return (
    <div className={isNav ? 'litenova-nav-logo' : 'litenova-auth-logo'}>
      <div className={isNav ? 'litenova-nav-logo-icon' : 'litenova-auth-logo-icon'}>
        L
      </div>
      <span className={isNav ? 'litenova-nav-logo-text' : 'litenova-auth-logo-text'}>
        LiteNova
      </span>
    </div>
  );
};

const Header = () => {
  const { t, i18n } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  let navigate = useNavigate();

  const [showSidebar, setShowSidebar] = useState(false);

  async function logout() {
    setShowSidebar(false);
    await API.get('/api/user/logout');
    showSuccess('注销成功!');
    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    navigate('/login');
  }

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const renderButtons = (mobile) => {
    return headerButtons.map((button) => {
      if (button.admin && !isAdmin()) return <React.Fragment key={button.name}></React.Fragment>;
      if (mobile) {
        return (
          <Menu.Item
            key={button.name}
            onClick={() => {
              navigate(button.to);
              setShowSidebar(false);
            }}
            style={{ fontSize: '15px' }}
          >
            {t(button.name)}
          </Menu.Item>
        );
      }
      return (
        <Menu.Item
          key={button.name}
          as={Link}
          to={button.to}
          style={{
            fontSize: '15px',
            fontWeight: '400',
            color: '#64748b',
          }}
        >
          <Icon name={button.icon} style={{ marginRight: '4px' }} />
          {t(button.name)}
        </Menu.Item>
      );
    });
  };

  const languageOptions = [
    { key: 'zh', text: '中文', value: 'zh' },
    { key: 'en', text: 'English', value: 'en' },
  ];

  const changeLanguage = (language) => {
    i18n.changeLanguage(language);
  };

  if (isMobile()) {
    return (
      <>
        <Menu
          borderless
          size='large'
          style={
            showSidebar
              ? {
                  borderBottom: 'none',
                  marginBottom: '0',
                  borderTop: 'none',
                  height: '51px',
                }
              : { borderTop: 'none', height: '52px' }
          }
        >
          <Container
            style={{
              width: '100%',
              maxWidth: '100%',
              padding: '0 10px',
            }}
          >
            <Menu.Item as={Link} to='/'>
              <LiteNovaLogo size="nav" />
            </Menu.Item>
            <Menu.Menu position='right'>
              <Menu.Item onClick={toggleSidebar}>
                <Icon name={showSidebar ? 'close' : 'sidebar'} />
              </Menu.Item>
            </Menu.Menu>
          </Container>
        </Menu>
        {showSidebar ? (
          <Segment style={{ marginTop: 0, borderTop: '0' }}>
            <Menu secondary vertical style={{ width: '100%', margin: 0 }}>
              {renderButtons(true)}
              <Menu.Item>
                <Dropdown
                  selection
                  trigger={
                    <Icon
                      name='language'
                      style={{ margin: 0, fontSize: '18px' }}
                    />
                  }
                  options={languageOptions}
                  value={i18n.language}
                  onChange={(_, { value }) => changeLanguage(value)}
                />
              </Menu.Item>
              <Menu.Item>
                {userState.user ? (
                  <Button onClick={logout} style={{ color: '#666666' }}>
                    {t('header.logout')}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        setShowSidebar(false);
                        navigate('/login');
                      }}
                    >
                      {t('header.login')}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowSidebar(false);
                        navigate('/register');
                      }}
                    >
                      {t('header.register')}
                    </Button>
                  </>
                )}
              </Menu.Item>
            </Menu>
          </Segment>
        ) : (
          <></>
        )}
      </>
    );
  }

  return (
    <>
      <Menu
        borderless
        style={{
          borderTop: 'none',
          boxShadow: '0 1px 3px rgba(99, 102, 241, 0.08)',
          border: 'none',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Container
          style={{
            width: '100%',
            maxWidth: '1200px',
            padding: '0 20px',
          }}
        >
          <Menu.Item as={Link} to='/' className='hide-on-mobile'>
            <LiteNovaLogo size="nav" />
          </Menu.Item>
          {renderButtons(false)}
          <Menu.Menu position='right'>
            <Dropdown
              item
              trigger={
                <Icon name='language' style={{ margin: 0, fontSize: '18px' }} />
              }
              options={languageOptions}
              value={i18n.language}
              onChange={(_, { value }) => changeLanguage(value)}
              style={{
                fontSize: '16px',
                fontWeight: '400',
                color: '#64748b',
                padding: '0 10px',
              }}
            />
            {userState.user ? (
              <Dropdown
                text={userState.user.username}
                pointing
                className='link item'
                style={{
                  fontSize: '15px',
                  fontWeight: '400',
                  color: '#64748b',
                }}
              >
                <Dropdown.Menu>
                  <Dropdown.Item
                    onClick={logout}
                    style={{
                      fontSize: '15px',
                      fontWeight: '400',
                      color: '#666',
                    }}
                  >
                    {t('header.logout')}
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <Menu.Item
                name={t('header.login')}
                as={Link}
                to='/login'
                className='btn btn-link'
                style={{
                  fontSize: '15px',
                  fontWeight: '500',
                  color: '#6366f1',
                }}
              />
            )}
          </Menu.Menu>
        </Container>
      </Menu>
    </>
  );
};

export default Header;
