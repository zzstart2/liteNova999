import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Grid, Statistic, Icon, Dropdown, Segment } from 'semantic-ui-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import axios from 'axios';
import './Dashboard.css';

const chartConfig = {
  lineChart: {
    line: {
      strokeWidth: 2,
      dot: false,
      activeDot: { r: 4 },
    },
    grid: {
      vertical: false,
      horizontal: true,
      opacity: 0.1,
    },
  },
  colors: {
    requests: '#4318FF',
    quota: '#00B5D8',
    promptTokens: '#6C63FF',
    completionTokens: '#FF5E7D',
    tokens: '#6C63FF',
  },
  barColors: [
    '#4318FF',
    '#00B5D8',
    '#6C63FF',
    '#05CD99',
    '#FFB547',
    '#FF5E7D',
    '#41B883',
    '#7983FF',
    '#FF8F6B',
    '#49BEFF',
  ],
};

const RANGE_OPTIONS = [
  { key: '7d', text: '最近 7 天', value: 7 },
  { key: '14d', text: '最近 14 天', value: 14 },
  { key: '30d', text: '最近 30 天', value: 30 },
  { key: '90d', text: '最近 90 天', value: 90 },
];

const Dashboard = () => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [rangeDays, setRangeDays] = useState(7);
  const [summaryData, setSummaryData] = useState({
    todayRequests: 0,
    todayQuota: 0,
    todayTokens: 0,
    totalRequests: 0,
    totalQuota: 0,
    totalTokens: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get('/api/user/dashboard');
      if (response.data.success) {
        const dashboardData = response.data.data || [];
        setData(dashboardData);
        calculateSummary(dashboardData);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setData([]);
      calculateSummary([]);
    }
  };

  const calculateSummary = (dashboardData) => {
    if (!Array.isArray(dashboardData) || dashboardData.length === 0) {
      setSummaryData({ todayRequests: 0, todayQuota: 0, todayTokens: 0, totalRequests: 0, totalQuota: 0, totalTokens: 0 });
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const todayData = dashboardData.filter((item) => item.Day === today);
    setSummaryData({
      todayRequests: todayData.reduce((s, i) => s + i.RequestCount, 0),
      todayQuota: todayData.reduce((s, i) => s + i.Quota, 0) / 500000,
      todayTokens: todayData.reduce((s, i) => s + i.PromptTokens + i.CompletionTokens, 0),
      totalRequests: dashboardData.reduce((s, i) => s + i.RequestCount, 0),
      totalQuota: dashboardData.reduce((s, i) => s + i.Quota, 0) / 500000,
      totalTokens: dashboardData.reduce((s, i) => s + i.PromptTokens + i.CompletionTokens, 0),
    });
  };

  const getFilteredData = () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return data.filter((item) => item.Day >= cutoffStr);
  };

  const processTimeSeriesData = () => {
    const filtered = getFilteredData();
    const dailyData = {};
    const maxDate = new Date();
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - (rangeDays - 1));

    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dailyData[dateStr] = { date: dateStr, requests: 0, quota: 0, promptTokens: 0, completionTokens: 0, tokens: 0 };
    }

    filtered.forEach((item) => {
      if (dailyData[item.Day]) {
        dailyData[item.Day].requests += item.RequestCount;
        dailyData[item.Day].quota += item.Quota / 500000;
        dailyData[item.Day].promptTokens += item.PromptTokens;
        dailyData[item.Day].completionTokens += item.CompletionTokens;
        dailyData[item.Day].tokens += item.PromptTokens + item.CompletionTokens;
      }
    });

    return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
  };

  const processModelPieData = () => {
    const filtered = getFilteredData();
    const modelMap = {};
    filtered.forEach((item) => {
      if (!modelMap[item.ModelName]) modelMap[item.ModelName] = 0;
      modelMap[item.ModelName] += item.RequestCount;
    });
    return Object.entries(modelMap).map(([name, value]) => ({ name, value }));
  };

  const processModelBarData = () => {
    const filtered = getFilteredData();
    const timeData = {};
    const maxDate = new Date();
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - (rangeDays - 1));
    const models = [...new Set(filtered.map((item) => item.ModelName))];

    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      timeData[dateStr] = { date: dateStr };
      models.forEach((model) => { timeData[dateStr][model] = 0; });
    }

    filtered.forEach((item) => {
      if (timeData[item.Day]) {
        timeData[item.Day][item.ModelName] = item.PromptTokens + item.CompletionTokens;
      }
    });

    return { barData: Object.values(timeData).sort((a, b) => a.date.localeCompare(b.date)), models };
  };

  const timeSeriesData = processTimeSeriesData();
  const pieData = processModelPieData();
  const { barData, models } = processModelBarData();

  const getRandomColor = (index) => chartConfig.barColors[index % chartConfig.barColors.length];

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  };

  const xAxisConfig = {
    dataKey: 'date',
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 12, fill: '#A3AED0', textAnchor: 'middle' },
    tickFormatter: formatDate,
    interval: rangeDays > 14 ? Math.floor(rangeDays / 7) - 1 : 0,
    minTickGap: 5,
    padding: { left: 30, right: 30 },
  };

  const tooltipStyle = {
    background: '#fff',
    border: 'none',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  };

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent < 0.05) return null;
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className='dashboard-container'>
      {/* Summary Stat Cards */}
      <Grid columns={3} stackable className='stat-cards-grid'>
        <Grid.Column>
          <Segment className='summary-stat-card' style={{ background: 'linear-gradient(135deg, #4318FF 0%, #6C63FF 100%)' }}>
            <Statistic inverted size='small'>
              <Statistic.Label style={{ color: 'rgba(255,255,255,0.8)' }}>
                <Icon name='lightning' /> 今日请求
              </Statistic.Label>
              <Statistic.Value>{summaryData.todayRequests}</Statistic.Value>
            </Statistic>
            <div className='stat-sub'>累计 {summaryData.totalRequests}</div>
          </Segment>
        </Grid.Column>
        <Grid.Column>
          <Segment className='summary-stat-card' style={{ background: 'linear-gradient(135deg, #00B5D8 0%, #00D4AA 100%)' }}>
            <Statistic inverted size='small'>
              <Statistic.Label style={{ color: 'rgba(255,255,255,0.8)' }}>
                <Icon name='dollar' /> 今日消费
              </Statistic.Label>
              <Statistic.Value>${summaryData.todayQuota.toFixed(4)}</Statistic.Value>
            </Statistic>
            <div className='stat-sub'>累计 ${summaryData.totalQuota.toFixed(4)}</div>
          </Segment>
        </Grid.Column>
        <Grid.Column>
          <Segment className='summary-stat-card' style={{ background: 'linear-gradient(135deg, #FF5E7D 0%, #FFB547 100%)' }}>
            <Statistic inverted size='small'>
              <Statistic.Label style={{ color: 'rgba(255,255,255,0.8)' }}>
                <Icon name='fire' /> 今日 Token
              </Statistic.Label>
              <Statistic.Value>{summaryData.todayTokens.toLocaleString()}</Statistic.Value>
            </Statistic>
            <div className='stat-sub'>累计 {summaryData.totalTokens.toLocaleString()}</div>
          </Segment>
        </Grid.Column>
      </Grid>

      {/* Time Range Selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, marginTop: 4 }}>
        <Dropdown
          selection
          compact
          options={RANGE_OPTIONS}
          value={rangeDays}
          onChange={(e, { value }) => setRangeDays(value)}
          style={{ minWidth: 140 }}
        />
      </div>

      {/* Request + Quota + Token Trend Charts (3 columns) */}
      <Grid columns={3} stackable className='charts-grid'>
        <Grid.Column>
          <Card fluid className='chart-card'>
            <Card.Content>
              <Card.Header>{t('dashboard.charts.requests.title')}</Card.Header>
              <div className='chart-container'>
                <ResponsiveContainer width='100%' height={140}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray='3 3' vertical={false} opacity={0.1} />
                    <XAxis {...xAxisConfig} />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, t('dashboard.charts.requests.tooltip')]} labelFormatter={(l) => `日期: ${formatDate(l)}`} />
                    <Line type='monotone' dataKey='requests' stroke={chartConfig.colors.requests} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card.Content>
          </Card>
        </Grid.Column>

        <Grid.Column>
          <Card fluid className='chart-card'>
            <Card.Content>
              <Card.Header>{t('dashboard.charts.quota.title')}</Card.Header>
              <div className='chart-container'>
                <ResponsiveContainer width='100%' height={140}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray='3 3' vertical={false} opacity={0.1} />
                    <XAxis {...xAxisConfig} />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v.toFixed(6), t('dashboard.charts.quota.tooltip')]} labelFormatter={(l) => `日期: ${formatDate(l)}`} />
                    <Line type='monotone' dataKey='quota' stroke={chartConfig.colors.quota} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card.Content>
          </Card>
        </Grid.Column>

        <Grid.Column>
          <Card fluid className='chart-card'>
            <Card.Content>
              <Card.Header>{t('dashboard.charts.tokens.title')}</Card.Header>
              <div className='chart-container'>
                <ResponsiveContainer width='100%' height={140}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray='3 3' vertical={false} opacity={0.1} />
                    <XAxis {...xAxisConfig} />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `日期: ${formatDate(l)}`} />
                    <Legend verticalAlign='top' height={24} />
                    <Line type='monotone' name='Prompt Tokens' dataKey='promptTokens' stroke={chartConfig.colors.promptTokens} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type='monotone' name='Completion Tokens' dataKey='completionTokens' stroke={chartConfig.colors.completionTokens} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card.Content>
          </Card>
        </Grid.Column>
      </Grid>

      {/* Model Distribution: Pie Chart + Stacked Bar Chart */}
      <Grid columns={2} stackable className='charts-grid'>
        <Grid.Column width={6}>
          <Card fluid className='chart-card'>
            <Card.Content>
              <Card.Header>模型调用分布</Card.Header>
              <div className='chart-container'>
                <ResponsiveContainer width='100%' height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx='50%'
                      cy='50%'
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={100}
                      dataKey='value'
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getRandomColor(index)} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value} 次`, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card.Content>
          </Card>
        </Grid.Column>

        <Grid.Column width={10}>
          <Card fluid className='chart-card'>
            <Card.Content>
              <Card.Header>{t('dashboard.statistics.title')}</Card.Header>
              <div className='chart-container'>
                <ResponsiveContainer width='100%' height={300}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray='3 3' vertical={false} opacity={0.1} />
                    <XAxis {...xAxisConfig} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#A3AED0' }} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `日期: ${formatDate(l)}`} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    {models.map((model, index) => (
                      <Bar key={model} dataKey={model} stackId='a' fill={getRandomColor(index)} name={model} radius={index === models.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Content>
          </Card>
        </Grid.Column>
      </Grid>
    </div>
  );
};

export default Dashboard;
