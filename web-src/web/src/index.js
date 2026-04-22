import React, { useContext } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import App from './App';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import 'semantic-ui-css/semantic.min.css';
import './index.css';
import { UserContext, UserProvider } from './context/User';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { StatusProvider } from './context/Status';
import './i18n';

const Layout = () => {
  const location = useLocation();
  const [userState] = useContext(UserContext);

  const authPaths = ['/login', '/register', '/reset', '/oauth'];
  const isAuthPage = authPaths.some((p) => location.pathname.startsWith(p));
  const isLandingPage = location.pathname === '/' && !userState.user;

  // Full-screen layout for auth pages
  if (isAuthPage) {
    return (
      <div className='ln-layout ln-layout-auth'>
        <main className='ln-main-auth'>
          <App />
        </main>
      </div>
    );
  }

  // Landing page: no sidebar, just topbar + content
  if (isLandingPage) {
    return (
      <div className='ln-layout ln-layout-landing'>
        <Topbar />
        <main className='ln-main-landing'>
          <App />
        </main>
      </div>
    );
  }

  // App layout: sidebar + topbar + content
  return (
    <div className='ln-layout ln-layout-app'>
      <Sidebar />
      <div className='ln-content-wrapper'>
        <Topbar />
        <main className='ln-main'>
          <App />
        </main>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <StatusProvider>
      <UserProvider>
        <BrowserRouter>
          <Layout />
          <ToastContainer position='top-right' autoClose={3000} />
        </BrowserRouter>
      </UserProvider>
    </StatusProvider>
  </React.StrictMode>
);
