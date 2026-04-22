import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showNotice } from '../../helpers';
import { StatusContext } from '../../context/Status';
import { marked } from 'marked';
import { UserContext } from '../../context/User';
import { Link } from 'react-router-dom';

const Home = () => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [userState] = useContext(UserContext);

  const displayNotice = async () => {
    try {
      const res = await API.get('/api/notice');
      const { success, data } = res.data || {};
      if (success && data) {
        let oldNotice = localStorage.getItem('notice');
        if (data !== oldNotice && data !== '') {
          const htmlNotice = marked(data);
          showNotice(htmlNotice, true);
          localStorage.setItem('notice', data);
        }
      }
    } catch (e) {
      // API not available, ignore silently
    }
  };

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    try {
      const res = await API.get('/api/home_page_content');
      const { success, data } = res.data || {};
      if (success && data) {
        let content = data;
        if (!data.startsWith('https://')) {
          content = marked.parse(data);
        }
        setHomePageContent(content);
        localStorage.setItem('home_page_content', content);
      }
    } catch (e) {
      // API not available, ignore silently
    }
    setHomePageContentLoaded(true);
  };

  useEffect(() => {
    displayNotice().then();
    displayHomePageContent().then();
  }, []);

  // If the admin has set custom home page content, show that
  if (homePageContentLoaded && homePageContent && homePageContent !== '') {
    if (homePageContent.startsWith('https://')) {
      return (
        <iframe
          src={homePageContent}
          style={{ width: '100%', height: '100vh', border: 'none' }}
          title="home"
        />
      );
    }
    return (
      <div
        style={{ fontSize: 'larger' }}
        dangerouslySetInnerHTML={{ __html: homePageContent }}
      />
    );
  }

  return (
    <div className="full-width-page">
      {/* Hero Section */}
      <div className="litenova-hero">
        <div className="litenova-hero-content">
          <div className="litenova-logo-hero">
            <div className="litenova-logo-icon">L</div>
            <span className="litenova-logo-text-hero">LiteNova</span>
          </div>
          <p className="litenova-slogan">
            智能 API 中转，一站式 AI 模型接入<br />
            <span style={{ fontSize: '16px', opacity: 0.7 }}>
              兼容 OpenAI SDK · 支持千问全系列模型 · 企业级稳定性
            </span>
          </p>
          <div className="litenova-hero-actions">
            {userState.user ? (
              <Link to="/token" className="litenova-btn-primary">
                🔑 管理 API 密钥
              </Link>
            ) : (
              <Link to="/register" className="litenova-btn-primary">
                🚀 免费注册
              </Link>
            )}
            <a href="#quickstart" className="litenova-btn-secondary">
              📖 快速开始
            </a>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="litenova-features">
        <h2 className="litenova-section-title">核心能力</h2>
        <p className="litenova-section-subtitle">
          一个平台，接入所有千问大模型
        </p>
        <div className="litenova-features-grid">
          <div className="litenova-feature-card">
            <div className="litenova-feature-icon">🔄</div>
            <h3 className="litenova-feature-title">API 中转</h3>
            <p className="litenova-feature-desc">
              完全兼容 OpenAI SDK 格式，无缝对接千问 API。
              一行代码切换，无需修改现有应用。
            </p>
          </div>
          <div className="litenova-feature-card">
            <div className="litenova-feature-icon">🤖</div>
            <h3 className="litenova-feature-title">多模型支持</h3>
            <p className="litenova-feature-desc">
              支持 qwen-turbo、qwen-plus、qwen-max 等全系列模型。
              按需选择，灵活切换。
            </p>
          </div>
          <div className="litenova-feature-card">
            <div className="litenova-feature-icon">⚡</div>
            <h3 className="litenova-feature-title">分组限流与计费</h3>
            <p className="litenova-feature-desc">
              精细化用户分组管理，支持 QPS 限流、Token 计费和模型倍率配置。
            </p>
          </div>
        </div>
      </div>

      {/* Models Section */}
      <div className="litenova-models">
        <h2 className="litenova-section-title">支持模型</h2>
        <p className="litenova-section-subtitle">
          千问系列大模型，按需选用
        </p>
        <div style={{ padding: '0 20px' }}>
          <table className="litenova-model-table">
            <thead>
              <tr>
                <th>模型</th>
                <th>倍率</th>
                <th>适用场景</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <span className="litenova-model-badge basic">qwen-turbo</span>
                </td>
                <td>1.2x</td>
                <td>日常对话、快速响应场景</td>
              </tr>
              <tr>
                <td>
                  <span className="litenova-model-badge plus">qwen-plus</span>
                </td>
                <td>2.0x</td>
                <td>复杂推理、内容创作</td>
              </tr>
              <tr>
                <td>
                  <span className="litenova-model-badge max">qwen-max</span>
                </td>
                <td>8.0x</td>
                <td>旗舰能力、高难度任务</td>
              </tr>
              <tr>
                <td>
                  <span className="litenova-model-badge long">qwen-max-longcontext</span>
                </td>
                <td>10.0x</td>
                <td>超长文本处理</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Start Section */}
      <div className="litenova-quickstart" id="quickstart">
        <h2 className="litenova-section-title">快速开始</h2>
        <p className="litenova-section-subtitle">
          三步即可开始使用
        </p>
        <div className="litenova-steps">
          <div className="litenova-step">
            <div className="litenova-step-number">1</div>
            <h3 className="litenova-step-title">注册账号</h3>
            <p className="litenova-step-desc">
              创建您的 LiteNova 账号，选择适合的套餐方案
            </p>
          </div>
          <div className="litenova-step">
            <div className="litenova-step-number">2</div>
            <h3 className="litenova-step-title">获取 API Key</h3>
            <p className="litenova-step-desc">
              在控制台创建令牌，获取您的专属 API Key
            </p>
          </div>
          <div className="litenova-step">
            <div className="litenova-step-number">3</div>
            <h3 className="litenova-step-title">调用 API</h3>
            <p className="litenova-step-desc">
              使用 OpenAI SDK 格式调用，一行代码即可接入
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Home;
