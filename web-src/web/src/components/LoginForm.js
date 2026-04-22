import React, { useContext, useEffect, useState } from 'react';
import {
  Button,
  Divider,
  Form,
  Header,
  Modal,
  Image,
  Card,
} from 'semantic-ui-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../context/User';
import { API, showError, showSuccess, showWarning } from '../helpers';
import { onLarkOAuthClicked } from './utils';
import larkIcon from '../images/lark.svg';

const LoginForm = () => {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState({
    username: '',
    password: '',
    wechat_verification_code: '',
  });
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const { username, password } = inputs;
  const [userState, userDispatch] = useContext(UserContext);
  const navigate = useNavigate();
  const [status, setStatus] = useState({});
  const [showWeChatLoginModal, setShowWeChatLoginModal] = useState(false);

  useEffect(() => {
    if (searchParams.get('expired')) {
      showError(t('messages.error.login_expired'));
    }
    let s = localStorage.getItem('status');
    if (s) setStatus(JSON.parse(s));
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setInputs((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit() {
    if (!username || !password) {
      showError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/api/user/login', { username, password });
      const { success, message, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
        localStorage.setItem('user', JSON.stringify(data));
        showSuccess(t('messages.success.login'));
        if (username === 'root' && password === '123456') {
          navigate('/user/edit');
          showWarning(t('messages.error.root_password'));
        } else {
          navigate('/dashboard');
        }
      } else {
        showError(message);
      }
    } catch (err) {
      showError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit();
  }

  const onSubmitWeChatVerificationCode = async () => {
    const res = await API.get(`/api/oauth/wechat?code=${inputs.wechat_verification_code}`);
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
      localStorage.setItem('user', JSON.stringify(data));
      navigate('/');
      showSuccess(t('messages.success.login'));
      setShowWeChatLoginModal(false);
    } else {
      showError(message);
    }
  };

  return (
    <>
      <Card className='auth-card'>
        <Card.Content>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div className='litenova-auth-logo' style={{ marginBottom: 8 }}>
              <div className='litenova-auth-logo-icon'>L</div>
              <span className='litenova-auth-logo-text'>LiteNova</span>
            </div>
            <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
              {t('auth.login.title')}
            </p>
          </div>

          <Form size='large' onKeyDown={handleKeyDown}>
            <Form.Input
              fluid
              icon='user'
              iconPosition='left'
              placeholder={t('auth.login.username')}
              name='username'
              value={username}
              onChange={handleChange}
              style={{ marginBottom: 12 }}
            />
            <Form.Input
              fluid
              icon='lock'
              iconPosition='left'
              placeholder={t('auth.login.password')}
              name='password'
              type='password'
              value={password}
              onChange={handleChange}
              style={{ marginBottom: 20 }}
            />
            <Button
              fluid
              size='large'
              className={`auth-btn ${loading ? 'loading' : ''}`}
              onClick={handleSubmit}
              loading={loading}
              disabled={loading}
            >
              {t('auth.login.button')}
            </Button>
          </Form>

          <div className='auth-links' style={{ marginTop: 20 }}>
            <div>
              <Link to='/reset'>{t('auth.login.reset_password')}</Link>
            </div>
            <div>
              {t('auth.login.no_account')}
              <Link to='/register'>{t('auth.login.register')}</Link>
            </div>
          </div>

          {(status.wechat_login || status.lark_client_id) && (
            <>
              <Divider horizontal style={{ color: '#94a3b8', fontSize: '0.85em', margin: '20px 0 16px' }}>
                {t('auth.login.other_methods')}
              </Divider>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                {status.wechat_login && (
                  <Button circular color='green' icon='wechat' onClick={() => setShowWeChatLoginModal(true)} />
                )}
                {status.lark_client_id && (
                  <div
                    style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', display: 'flex', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
                    onClick={() => onLarkOAuthClicked(status.lark_client_id)}
                  >
                    <Image src={larkIcon} avatar style={{ width: 36, height: 36, margin: 'auto' }} />
                  </div>
                )}
              </div>
            </>
          )}
        </Card.Content>
      </Card>

      <Modal
        onClose={() => setShowWeChatLoginModal(false)}
        open={showWeChatLoginModal}
        size='mini'
      >
        <Modal.Content>
          <Image src={status.wechat_qrcode} fluid />
          <p style={{ textAlign: 'center', margin: '12px 0' }}>{t('auth.login.wechat.scan_tip')}</p>
          <Form size='large'>
            <Form.Input
              fluid
              placeholder={t('auth.login.wechat.code_placeholder')}
              name='wechat_verification_code'
              value={inputs.wechat_verification_code}
              onChange={handleChange}
            />
            <Button fluid size='large' className='auth-btn' onClick={onSubmitWeChatVerificationCode}>
              {t('auth.login.button')}
            </Button>
          </Form>
        </Modal.Content>
      </Modal>
    </>
  );
};

export default LoginForm;
