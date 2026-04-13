import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Grid,
  Table,
  Label,
  Icon,
  Button,
  Segment,
  Header,
  Popup,
  Progress,
} from 'semantic-ui-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { API, showError } from '../../helpers';
import './ChannelHealth.css';

const ChannelHealth = () => {
  const [healthData, setHealthData] = useState({});
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const [healthRes, channelRes] = await Promise.all([
        API.get('/api/channel/health'),
        API.get('/api/channel/'),
      ]);

      if (healthRes.data.success) {
        setHealthData(healthRes.data.data || {});
      }
      if (channelRes.data.success) {
        setChannels(channelRes.data.data || []);
      }
    } catch (err) {
      showError(err.message || 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const getCircuitColor = (state) => {
    switch (state) {
      case 'closed':
        return 'green';
      case 'open':
        return 'red';
      case 'half_open':
        return 'orange';
      default:
        return 'grey';
    }
  };

  const getCircuitLabel = (state) => {
    switch (state) {
      case 'closed':
        return '正常';
      case 'open':
        return '熔断';
      case 'half_open':
        return '半开';
      default:
        return '未知';
    }
  };

  const getHealthColor = (score) => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'olive';
    if (score >= 40) return 'yellow';
    if (score >= 20) return 'orange';
    return 'red';
  };

  // Build channel map for quick lookup
  const channelMap = {};
  channels.forEach((ch) => {
    channelMap[ch.id] = ch;
  });

  // Build chart data
  const chartData = Object.entries(healthData)
    .map(([id, info]) => {
      const ch = channelMap[parseInt(id)];
      return {
        name: ch ? ch.name : `#${id}`,
        healthScore: info.metrics?.health_score || 0,
        errorRate: ((info.metrics?.error_rate || 0) * 100).toFixed(1),
        avgLatency: (info.metrics?.avg_latency_ms || 0).toFixed(0),
        requests: info.metrics?.request_count || 0,
      };
    })
    .filter((d) => d.requests > 0)
    .sort((a, b) => b.healthScore - a.healthScore);

  return (
    <div className="channel-health-container">
      <Header as="h2">
        <Icon name="heartbeat" />
        <Header.Content>
          渠道健康监控
          <Header.Subheader>实时健康检查 + 熔断器状态</Header.Subheader>
        </Header.Content>
      </Header>

      <Button
        icon="refresh"
        content="刷新"
        onClick={fetchHealth}
        loading={loading}
        style={{ marginBottom: 16 }}
      />

      {/* Health Score Bar Chart */}
      {chartData.length > 0 && (
        <Card fluid style={{ marginBottom: 16 }}>
          <Card.Content>
            <Card.Header>健康分数概览</Card.Header>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === 'healthScore') return [`${value.toFixed(1)}`, '健康分'];
                      return [value, name];
                    }}
                  />
                  <Bar
                    dataKey="healthScore"
                    fill="#4318FF"
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Health Table */}
      <Segment loading={loading}>
        <Table celled structured>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>渠道</Table.HeaderCell>
              <Table.HeaderCell>健康分</Table.HeaderCell>
              <Table.HeaderCell>熔断状态</Table.HeaderCell>
              <Table.HeaderCell>请求数</Table.HeaderCell>
              <Table.HeaderCell>错误率</Table.HeaderCell>
              <Table.HeaderCell>平均延迟</Table.HeaderCell>
              <Table.HeaderCell>P99 延迟</Table.HeaderCell>
              <Table.HeaderCell>权重乘数</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {Object.entries(healthData).length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={8} textAlign="center">
                  暂无健康数据，渠道收到请求后将自动采集
                </Table.Cell>
              </Table.Row>
            ) : (
              Object.entries(healthData).map(([id, info]) => {
                const ch = channelMap[parseInt(id)];
                const metrics = info.metrics || {};
                const circuit = info.circuit || {};
                const score = metrics.health_score || 0;
                const errorRate = (metrics.error_rate || 0) * 100;

                return (
                  <Table.Row key={id}>
                    <Table.Cell>
                      <Popup
                        content={`ID: ${id}, Type: ${ch?.type || 'N/A'}`}
                        trigger={<span>{ch ? ch.name : `#${id}`}</span>}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Progress
                        percent={score}
                        size="small"
                        color={getHealthColor(score)}
                        style={{ marginBottom: 0 }}
                      />
                      <span style={{ fontSize: 12 }}>{score.toFixed(1)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Label color={getCircuitColor(circuit.state)} size="small">
                        {getCircuitLabel(circuit.state)}
                      </Label>
                    </Table.Cell>
                    <Table.Cell>{metrics.request_count || 0}</Table.Cell>
                    <Table.Cell>
                      <span style={{ color: errorRate > 10 ? 'red' : 'inherit' }}>
                        {errorRate.toFixed(1)}%
                      </span>
                    </Table.Cell>
                    <Table.Cell>{(metrics.avg_latency_ms || 0).toFixed(0)} ms</Table.Cell>
                    <Table.Cell>{(metrics.p99_latency_ms || 0)} ms</Table.Cell>
                    <Table.Cell>
                      {circuit.state === 'open'
                        ? '0.00'
                        : circuit.state === 'half_open'
                        ? '0.05'
                        : (0.1 + 0.9 * (score / 100)).toFixed(2)}
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table>
      </Segment>
    </div>
  );
};

export default ChannelHealth;
