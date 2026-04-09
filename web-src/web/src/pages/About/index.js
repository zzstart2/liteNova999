import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from 'semantic-ui-react';
import { API, showError } from '../../helpers';
import { marked } from 'marked';

const About = () => {
  const { t } = useTranslation();
  const [about, setAbout] = useState('');
  const [aboutLoaded, setAboutLoaded] = useState(false);

  const displayAbout = async () => {
    setAbout(localStorage.getItem('about') || '');
    const res = await API.get('/api/about');
    const { success, message, data } = res.data;
    if (success) {
      let aboutContent = data;
      if (!data.startsWith('https://')) {
        aboutContent = marked.parse(data);
      }
      setAbout(aboutContent);
      localStorage.setItem('about', aboutContent);
    } else {
      showError(message);
      setAbout('');
    }
    setAboutLoaded(true);
  };

  useEffect(() => {
    displayAbout().then();
  }, []);

  return (
    <>
      {aboutLoaded && about === '' ? (
        <div className='dashboard-container'>
          <Card fluid className='chart-card'>
            <Card.Content>
              <Card.Header className='header'>
                关于 LiteNova
              </Card.Header>
              <Card.Description style={{ lineHeight: '1.8', marginTop: '1em' }}>
                <p>
                  <strong>LiteNova</strong> 是一个智能 API 中转平台，提供一站式 AI 模型接入服务。
                </p>
                <p>
                  我们支持千问（Qwen）全系列大模型，提供兼容 OpenAI SDK 的 API 接口，
                  让您可以无缝集成 AI 能力到现有应用中。
                </p>
                <p>
                  平台特色：
                </p>
                <ul>
                  <li>完全兼容 OpenAI SDK 格式，一行代码即可切换</li>
                  <li>支持 qwen-turbo、qwen-plus、qwen-max 等全系列模型</li>
                  <li>精细化用户分组管理，灵活的 QPS 限流与 Token 计费</li>
                  <li>企业级稳定性，7x24 小时服务保障</li>
                </ul>
              </Card.Description>
            </Card.Content>
          </Card>
        </div>
      ) : (
        <>
          {about.startsWith('https://') ? (
            <iframe
              src={about}
              style={{ width: '100%', height: '100vh', border: 'none' }}
              title="about"
            />
          ) : (
            <div className='dashboard-container'>
              <Card fluid className='chart-card'>
                <Card.Content>
                  <div
                    style={{ fontSize: 'larger' }}
                    dangerouslySetInnerHTML={{ __html: about }}
                  ></div>
                </Card.Content>
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default About;
