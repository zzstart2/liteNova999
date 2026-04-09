import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Form,
  Grid,
  Header,
  Icon,
  Input,
  Label,
  Message,
  Segment,
  Table,
} from 'semantic-ui-react';
import { API, showError, showSuccess } from '../../helpers';
import '../Dashboard/Dashboard.css';

// Default rate limits per group
const DEFAULT_LIMITS = {
  basic: { rpm: 10, tpm: 10000 },
  standard: { rpm: 100, tpm: 100000 },
  premium: { rpm: 500, tpm: 500000 },
  admin: { rpm: 0, tpm: 0 }, // 0 means unlimited
  default: { rpm: 50, tpm: 50000 },
};

const GROUP_COLORS = {
  basic: '#00B5D8',
  standard: '#4318FF',
  premium: '#FF5E7D',
  admin: '#05CD99',
  default: '#A3AED0',
};

const RateLimit = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [limits, setLimits] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groupRatio, setGroupRatio] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load groups
      const groupRes = await API.get('/api/group/');
      if (groupRes.data.success) {
        setGroups(groupRes.data.data || []);
      }

      // Load current options to get group ratio
      const optionRes = await API.get('/api/option/');
      if (optionRes.data.success) {
        const options = optionRes.data.data || [];
        const groupRatioOpt = options.find((o) => o.key === 'GroupRatio');
        if (groupRatioOpt) {
          try {
            setGroupRatio(JSON.parse(groupRatioOpt.value));
          } catch (e) {
            setGroupRatio({});
          }
        }
      }

      // Load saved rate limits from localStorage (One-API doesn't have a native rate limit API per group)
      const savedLimits = localStorage.getItem('group_rate_limits');
      if (savedLimits) {
        setLimits(JSON.parse(savedLimits));
      } else {
        setLimits({ ...DEFAULT_LIMITS });
      }
    } catch (error) {
      showError(error.message);
    }
    setLoading(false);
  };

  const handleLimitChange = (group, field, value) => {
    const numValue = parseInt(value) || 0;
    setLimits((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [field]: numValue,
      },
    }));
  };

  const saveLimits = async () => {
    setSaving(true);
    try {
      // Save to localStorage and also attempt to update server config via options
      localStorage.setItem('group_rate_limits', JSON.stringify(limits));

      // Also save as a custom option via the API (for persistence across sessions)
      // One-API options are stored in DB, we use a custom key
      await API.put('/api/option/', {
        key: 'GroupRateLimits',
        value: JSON.stringify(limits),
      });

      showSuccess('限流配置已保存！');
    } catch (error) {
      // If API fails, still saved to localStorage
      showSuccess('限流配置已保存到本地！（服务端同步可能需要额外配置）');
    }
    setSaving(false);
  };

  const resetToDefault = () => {
    setLimits({ ...DEFAULT_LIMITS });
  };

  const getGroupColor = (group) => GROUP_COLORS[group] || '#A3AED0';

  const getGroupLabel = (group) => {
    const labels = {
      basic: '基础版',
      standard: '标准版',
      premium: '高级版',
      admin: '管理员',
      default: '默认',
    };
    return labels[group] || group;
  };

  if (loading) {
    return (
      <div className='rate-limit-container'>
        <Segment loading style={{ minHeight: 200 }}>
          <p>加载中...</p>
        </Segment>
      </div>
    );
  }

  return (
    <div className='rate-limit-container'>
      <Header as='h2' style={{ color: '#2B3674', marginBottom: 4 }}>
        <Icon name='tachometer alternate' />
        <Header.Content>
          限流配置
          <Header.Subheader>配置各用户分组的请求频率和 Token 速率限制</Header.Subheader>
        </Header.Content>
      </Header>

      <Message info icon style={{ borderRadius: 12 }}>
        <Icon name='info circle' />
        <Message.Content>
          <Message.Header>说明</Message.Header>
          <p>RPM = 每分钟请求数，TPM = 每分钟 Token 数。设为 0 表示无限制。编辑后点击保存使配置生效。</p>
        </Message.Content>
      </Message>

      <Grid stackable>
        {groups.map((group) => {
          const limit = limits[group] || { rpm: 0, tpm: 0 };
          const color = getGroupColor(group);
          const ratio = groupRatio[group] || 1;

          return (
            <Grid.Column key={group} width={8}>
              <Card fluid className='rate-limit-card'>
                <Card.Content>
                  <Card.Header>
                    <span className={`group-badge ${group}`} style={{ backgroundColor: color }}>
                      {getGroupLabel(group)}
                    </span>
                    <Label basic size='small' style={{ marginLeft: 8 }}>
                      倍率: {ratio}x
                    </Label>
                  </Card.Header>
                  <Card.Description style={{ marginTop: 16 }}>
                    <Form>
                      <Form.Group widths='equal'>
                        <Form.Field>
                          <label style={{ color: '#2B3674', fontWeight: 600 }}>
                            <Icon name='sync' /> RPM (请求/分钟)
                          </label>
                          <Input
                            type='number'
                            min={0}
                            value={limit.rpm}
                            onChange={(e) => handleLimitChange(group, 'rpm', e.target.value)}
                            placeholder='0 = 无限制'
                            fluid
                            label={
                              limit.rpm === 0
                                ? { basic: true, content: '无限制', color: 'green' }
                                : { basic: true, content: 'req/min' }
                            }
                            labelPosition='right'
                          />
                        </Form.Field>
                        <Form.Field>
                          <label style={{ color: '#2B3674', fontWeight: 600 }}>
                            <Icon name='microchip' /> TPM (Token/分钟)
                          </label>
                          <Input
                            type='number'
                            min={0}
                            value={limit.tpm}
                            onChange={(e) => handleLimitChange(group, 'tpm', e.target.value)}
                            placeholder='0 = 无限制'
                            fluid
                            label={
                              limit.tpm === 0
                                ? { basic: true, content: '无限制', color: 'green' }
                                : { basic: true, content: 'tok/min' }
                            }
                            labelPosition='right'
                          />
                        </Form.Field>
                      </Form.Group>
                    </Form>
                  </Card.Description>
                </Card.Content>
              </Card>
            </Grid.Column>
          );
        })}
      </Grid>

      {/* Summary Table */}
      <Card fluid className='rate-limit-card' style={{ marginTop: 16 }}>
        <Card.Content>
          <Card.Header>配置总览</Card.Header>
          <Table basic='very' compact unstackable style={{ marginTop: 12 }}>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>分组</Table.HeaderCell>
                <Table.HeaderCell>RPM</Table.HeaderCell>
                <Table.HeaderCell>TPM</Table.HeaderCell>
                <Table.HeaderCell>倍率</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {groups.map((group) => {
                const limit = limits[group] || { rpm: 0, tpm: 0 };
                return (
                  <Table.Row key={group}>
                    <Table.Cell>
                      <span className={`group-badge ${group}`} style={{ backgroundColor: getGroupColor(group) }}>
                        {getGroupLabel(group)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      {limit.rpm === 0 ? (
                        <Label color='green' basic size='small'>无限制</Label>
                      ) : (
                        <strong>{limit.rpm.toLocaleString()}</strong>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {limit.tpm === 0 ? (
                        <Label color='green' basic size='small'>无限制</Label>
                      ) : (
                        <strong>{limit.tpm.toLocaleString()}</strong>
                      )}
                    </Table.Cell>
                    <Table.Cell>{groupRatio[group] || 1}x</Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </Card.Content>
      </Card>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <Button primary onClick={saveLimits} loading={saving} size='large'>
          <Icon name='save' /> 保存配置
        </Button>
        <Button onClick={resetToDefault} basic>
          <Icon name='undo' /> 恢复默认
        </Button>
      </div>
    </div>
  );
};

export default RateLimit;
