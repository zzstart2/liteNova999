import React from 'react';
import {
  Button,
  Container,
  Grid,
  Header,
  Icon,
  List,
  Segment,
  Card,
  Accordion,
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import './Landing.css';

const FEATURES = [
  {
    icon: 'exchange',
    title: 'OpenAI 兼容',
    desc: '完全兼容 OpenAI SDK，一行代码即可切换到千问模型。',
  },
  {
    icon: 'shield',
    title: '多级鉴权',
    desc: '用户分组 + Token 级权限控制，安全管理 API 访问。',
  },
  {
    icon: 'chart line',
    title: 'Token 级计费',
    desc: '精确到 Token 的用量统计和计费，模型倍率灵活配置。',
  },
  {
    icon: 'random',
    title: '智能 Fallback',
    desc: 'Provider 故障自动切换备用渠道，健康检查 + 熔断器保障可用性。',
  },
  {
    icon: 'plug',
    title: '多厂商透传',
    desc: '原生 API 透传模式，支持千问、Anthropic、Gemini 等多厂商。',
  },
  {
    icon: 'dashboard',
    title: '管理后台',
    desc: '可视化仪表盘，实时监控用量、渠道健康和系统状态。',
  },
];

const PRICING = [
  {
    name: 'Basic',
    price: '免费',
    features: ['qwen-turbo 模型', '10K Tokens/月', '10 QPS', '社区支持'],
    color: 'blue',
  },
  {
    name: 'Standard',
    price: '¥99/月',
    features: ['turbo + plus 模型', '无限 Tokens', '100 QPS', '邮件支持'],
    color: 'teal',
    popular: true,
  },
  {
    name: 'Premium',
    price: '¥299/月',
    features: ['全模型访问', '无限 Tokens', '500 QPS', '专属支持'],
    color: 'purple',
  },
];

const FAQ_PANELS = [
  {
    key: '1',
    title: '如何开始使用？',
    content: '注册账号后，在 Token 管理页面创建 API Key，然后使用 OpenAI SDK 设置 base_url 为本平台地址即可。',
  },
  {
    key: '2',
    title: '支持哪些模型？',
    content: '目前支持千问全系列（qwen-turbo、qwen-plus、qwen-max、qwen-max-longcontext），兼容 gpt-3.5-turbo 和 gpt-4 的请求格式。',
  },
  {
    key: '3',
    title: '透传模式是什么？',
    content: '透传模式将您的请求原样转发到上游 Provider，不做协议转换。适合需要使用厂商特有 API 的场景。',
  },
  {
    key: '4',
    title: '如何保障可用性？',
    content: '平台内置智能 Fallback 机制：实时健康检查 + 熔断器自动隔离故障渠道 + 多渠道自动切换。',
  },
];

const Landing = () => {
  const systemName = localStorage.getItem('system_name') || 'LiteNova';

  return (
    <div className="landing-page">
      {/* Hero */}
      <Segment
        inverted
        textAlign="center"
        className="hero-section"
        vertical
      >
        <Container text>
          <Header as="h1" inverted className="hero-title">
            {systemName}
          </Header>
          <Header as="h2" inverted className="hero-subtitle">
            统一 AI API 网关 — 千问全系列模型，OpenAI 兼容
          </Header>
          <p className="hero-desc">
            多厂商透传路由 / 智能 Fallback / Token 级计费 / 多级鉴权
          </p>
          <div className="hero-buttons">
            <Button as={Link} to="/register" primary size="huge">
              开始使用 <Icon name="arrow right" />
            </Button>
            <Button as={Link} to="/api-docs" size="huge" inverted>
              API 文档
            </Button>
          </div>
        </Container>
      </Segment>

      {/* Features */}
      <Segment vertical className="features-section">
        <Container>
          <Header as="h2" textAlign="center" style={{ marginBottom: 40 }}>
            核心能力
          </Header>
          <Grid columns={3} stackable>
            {FEATURES.map((f) => (
              <Grid.Column key={f.title}>
                <Segment textAlign="center" className="feature-card">
                  <Icon name={f.icon} size="huge" color="blue" />
                  <Header as="h3">{f.title}</Header>
                  <p>{f.desc}</p>
                </Segment>
              </Grid.Column>
            ))}
          </Grid>
        </Container>
      </Segment>

      {/* Pricing */}
      <Segment vertical className="pricing-section">
        <Container>
          <Header as="h2" textAlign="center" style={{ marginBottom: 40 }}>
            定价方案
          </Header>
          <Card.Group centered itemsPerRow={3} stackable>
            {PRICING.map((p) => (
              <Card key={p.name} color={p.color} raised={p.popular}>
                {p.popular && (
                  <div className="popular-badge">
                    <Icon name="star" /> 推荐
                  </div>
                )}
                <Card.Content textAlign="center">
                  <Card.Header style={{ fontSize: 24 }}>{p.name}</Card.Header>
                  <div className="price-tag">{p.price}</div>
                  <List>
                    {p.features.map((f) => (
                      <List.Item key={f}>
                        <Icon name="check" color="green" /> {f}
                      </List.Item>
                    ))}
                  </List>
                </Card.Content>
                <Card.Content extra textAlign="center">
                  <Button as={Link} to="/register" color={p.color} fluid>
                    选择方案
                  </Button>
                </Card.Content>
              </Card>
            ))}
          </Card.Group>
        </Container>
      </Segment>

      {/* FAQ */}
      <Segment vertical className="faq-section">
        <Container text>
          <Header as="h2" textAlign="center" style={{ marginBottom: 40 }}>
            常见问题
          </Header>
          <Accordion
            defaultActiveIndex={0}
            panels={FAQ_PANELS.map((p) => ({
              key: p.key,
              title: { content: p.title, icon: 'dropdown' },
              content: { content: p.content },
            }))}
            styled
            fluid
          />
        </Container>
      </Segment>

      {/* CTA */}
      <Segment inverted textAlign="center" className="cta-section" vertical>
        <Container text>
          <Header as="h2" inverted>
            准备好了吗？
          </Header>
          <p style={{ fontSize: 18, opacity: 0.9 }}>
            立即注册，开始使用千问 API
          </p>
          <Button as={Link} to="/register" primary size="huge">
            免费注册 <Icon name="arrow right" />
          </Button>
        </Container>
      </Segment>
    </div>
  );
};

export default Landing;
