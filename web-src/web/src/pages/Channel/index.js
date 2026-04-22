import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Icon,
  Label,
  Button,
  Segment,
  Header,
  Table,
  Accordion,
  Grid,
  Statistic,
  Popup,
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import { API, showError, showSuccess } from '../../helpers';
import './Channel.css';

const Channel = () => {
  const [providers, setProviders] = useState([]);
  const [activeProvider, setActiveProvider] = useState(-1);
  const [loading, setLoading] = useState(true);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await API.get('/api/channel/providers');
      if (res.data.success) {
        setProviders(res.data.data || []);
      }
    } catch (err) {
      // Fallback: use raw channel list and group manually
      try {
        const res = await API.get('/api/channel/');
        if (res.data.success) {
          const channels = res.data.data || [];
          const grouped = groupChannelsByType(channels);
          setProviders(grouped);
        }
      } catch (e) {
        showError('Failed to load providers');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Fallback grouping by channel type
  const groupChannelsByType = (channels) => {
    const typeNameMap = {
      17: { name: '千问', icon: 'qwen' },
      49: { name: '千问', icon: 'qwen' },
      1: { name: 'OpenAI', icon: 'openai' },
      14: { name: 'Anthropic', icon: 'anthropic' },
      36: { name: 'DeepSeek', icon: 'deepseek' },
      24: { name: 'Google Gemini', icon: 'gemini' },
    };

    const map = {};
    channels.forEach((ch) => {
      const meta = typeNameMap[ch.type] || { name: `Type ${ch.type}`, icon: 'server' };
      if (!map[meta.name]) {
        map[meta.name] = {
          provider: meta.name,
          icon: meta.icon,
          channels: [],
          all_models: [],
          status: 'disabled',
          total_used_quota: 0,
        };
      }
      const p = map[meta.name];
      const models = ch.models ? ch.models.split(',').filter(Boolean) : [];
      p.channels.push({
        id: ch.id,
        name: ch.name,
        type: ch.type,
        type_name: meta.name,
        status: ch.status,
        models: ch.models,
        model_count: models.length,
        response_time: ch.response_time,
        priority: ch.priority || 0,
        used_quota: ch.used_quota,
      });
      models.forEach((m) => {
        if (!p.all_models.includes(m.trim())) p.all_models.push(m.trim());
      });
      p.total_used_quota += ch.used_quota || 0;
      if (ch.status === 1) p.status = 'enabled';
    });

    return Object.values(map);
  };

  const handleTestChannel = async (channelId) => {
    try {
      const res = await API.get(`/api/channel/test/${channelId}`);
      if (res.data.success) {
        showSuccess(`测试通过 (${res.data.time?.toFixed(2) || '?'}s)`);
      } else {
        showError(res.data.message || '测试失败');
      }
    } catch (err) {
      showError('测试请求失败');
    }
  };

  const getStatusColor = (status) => {
    if (status === 'enabled' || status === 1) return 'green';
    if (status === 3) return 'orange';
    return 'grey';
  };

  const getStatusText = (status) => {
    if (status === 'enabled' || status === 1) return '运行中';
    if (status === 3) return '自动禁用';
    if (status === 2) return '手动禁用';
    return '未启用';
  };

  const handleAccordionClick = (index) => {
    setActiveProvider(activeProvider === index ? -1 : index);
  };

  return (
    <div className='provider-container'>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Header as='h2' style={{ margin: 0 }}>
          <Icon name='cloud' />
          <Header.Content>
            供应商管理
            <Header.Subheader>管理 AI 模型供应商和连接</Header.Subheader>
          </Header.Content>
        </Header>
        <Button as={Link} to='/channel/add' primary icon labelPosition='left'>
          <Icon name='plus' />
          添加连接
        </Button>
      </div>

      {/* Summary Stats */}
      <Grid columns={3} stackable style={{ marginBottom: 20 }}>
        <Grid.Column>
          <Segment textAlign='center'>
            <Statistic size='small'>
              <Statistic.Value>{providers.length}</Statistic.Value>
              <Statistic.Label>供应商</Statistic.Label>
            </Statistic>
          </Segment>
        </Grid.Column>
        <Grid.Column>
          <Segment textAlign='center'>
            <Statistic size='small'>
              <Statistic.Value>
                {providers.reduce((sum, p) => sum + p.channels.length, 0)}
              </Statistic.Value>
              <Statistic.Label>连接</Statistic.Label>
            </Statistic>
          </Segment>
        </Grid.Column>
        <Grid.Column>
          <Segment textAlign='center'>
            <Statistic size='small'>
              <Statistic.Value>
                {providers.reduce((sum, p) => sum + (p.all_models?.length || 0), 0)}
              </Statistic.Value>
              <Statistic.Label>可用模型</Statistic.Label>
            </Statistic>
          </Segment>
        </Grid.Column>
      </Grid>

      {/* Provider Cards */}
      <Segment loading={loading} style={{ padding: 0, border: 'none', boxShadow: 'none', background: 'transparent' }}>
        {providers.length === 0 && !loading && (
          <Segment placeholder textAlign='center'>
            <Header icon>
              <Icon name='cloud' />
              暂无供应商
            </Header>
            <Button as={Link} to='/channel/add' primary>
              添加第一个供应商
            </Button>
          </Segment>
        )}

        <Accordion styled fluid>
          {providers.map((provider, index) => (
            <React.Fragment key={provider.provider}>
              {/* Provider Header */}
              <Accordion.Title
                active={activeProvider === index}
                onClick={() => handleAccordionClick(index)}
                className='provider-accordion-title'
              >
                <div className='provider-header'>
                  <div className='provider-header-left'>
                    <Icon name='dropdown' />
                    <span className='provider-name'>{provider.provider}</span>
                    <Label color={getStatusColor(provider.status)} size='small'>
                      {getStatusText(provider.status)}
                    </Label>
                  </div>
                  <div className='provider-header-right'>
                    <Popup
                      content='可用模型数'
                      trigger={
                        <Label basic size='small'>
                          <Icon name='cube' /> {provider.all_models?.length || 0} 个模型
                        </Label>
                      }
                    />
                    <Popup
                      content='连接数'
                      trigger={
                        <Label basic size='small'>
                          <Icon name='plug' /> {provider.channels.length} 个连接
                        </Label>
                      }
                    />
                  </div>
                </div>
              </Accordion.Title>

              {/* Provider Content */}
              <Accordion.Content active={activeProvider === index}>
                <div className='provider-content'>
                  {/* Models List */}
                  <div className='provider-models'>
                    <strong>支持的模型：</strong>
                    <div style={{ marginTop: 6 }}>
                      {provider.all_models?.map((model) => (
                        <Label key={model} size='tiny' style={{ margin: '2px 4px 2px 0' }}>
                          {model}
                        </Label>
                      ))}
                    </div>
                  </div>

                  {/* Connections Table */}
                  <Table compact celled style={{ marginTop: 12 }}>
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell>连接名称</Table.HeaderCell>
                        <Table.HeaderCell>接口类型</Table.HeaderCell>
                        <Table.HeaderCell>状态</Table.HeaderCell>
                        <Table.HeaderCell>模型数</Table.HeaderCell>
                        <Table.HeaderCell>响应</Table.HeaderCell>
                        <Table.HeaderCell>优先级</Table.HeaderCell>
                        <Table.HeaderCell>操作</Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {provider.channels.map((ch) => (
                        <Table.Row key={ch.id}>
                          <Table.Cell>
                            <strong>{ch.name}</strong>
                          </Table.Cell>
                          <Table.Cell>
                            <Label size='tiny' color='blue'>
                              {ch.type_name}
                            </Label>
                          </Table.Cell>
                          <Table.Cell>
                            <Label
                              size='tiny'
                              color={getStatusColor(ch.status)}
                            >
                              {getStatusText(ch.status)}
                            </Label>
                          </Table.Cell>
                          <Table.Cell>{ch.model_count}</Table.Cell>
                          <Table.Cell>
                            {ch.response_time ? `${ch.response_time}ms` : '-'}
                          </Table.Cell>
                          <Table.Cell>{ch.priority}</Table.Cell>
                          <Table.Cell>
                            <Button
                              size='mini'
                              color='green'
                              onClick={() => handleTestChannel(ch.id)}
                            >
                              测试
                            </Button>
                            <Button
                              size='mini'
                              as={Link}
                              to={`/channel/edit/${ch.id}`}
                            >
                              编辑
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                </div>
              </Accordion.Content>
            </React.Fragment>
          ))}
        </Accordion>
      </Segment>
    </div>
  );
};

export default Channel;
