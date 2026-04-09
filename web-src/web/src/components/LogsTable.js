import React, { useEffect, useState } from 'react';
import {
  Button,
  Form,
  Header,
  Label,
  Modal,
  Pagination,
  Segment,
  Select,
  Table,
  Popup,
  Icon,
  Grid,
} from 'semantic-ui-react';
import {
  API,
  copy,
  isAdmin,
  showError,
  showSuccess,
  showWarning,
  timestamp2string,
} from '../helpers';
import { useTranslation } from 'react-i18next';

import { ITEMS_PER_PAGE } from '../constants';
import { renderColorLabel, renderQuota } from '../helpers/render';
import { Link } from 'react-router-dom';

function renderTimestamp(timestamp, request_id) {
  return (
    <code
      onClick={async () => {
        if (await copy(request_id)) {
          showSuccess(`已复制请求 ID：${request_id}`);
        } else {
          showWarning(`请求 ID 复制失败：${request_id}`);
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      {timestamp2string(timestamp)}
    </code>
  );
}

function renderType(type) {
  switch (type) {
    case 1:
      return <Label basic color='green'>充值</Label>;
    case 2:
      return <Label basic color='olive'>消费</Label>;
    case 3:
      return <Label basic color='orange'>管理</Label>;
    case 4:
      return <Label basic color='purple'>系统</Label>;
    case 5:
      return <Label basic color='violet'>测试</Label>;
    default:
      return <Label basic color='black'>未知</Label>;
  }
}

function getTypeName(type) {
  switch (type) {
    case 1: return '充值';
    case 2: return '消费';
    case 3: return '管理';
    case 4: return '系统';
    case 5: return '测试';
    default: return '未知';
  }
}

function getColorByElapsedTime(elapsedTime) {
  if (elapsedTime === undefined || 0) return 'black';
  if (elapsedTime < 1000) return 'green';
  if (elapsedTime < 3000) return 'olive';
  if (elapsedTime < 5000) return 'yellow';
  if (elapsedTime < 10000) return 'orange';
  return 'red';
}

function renderDetail(log) {
  return (
    <>
      {log.content}
      <br />
      {log.elapsed_time && (
        <Label basic size='mini' color={getColorByElapsedTime(log.elapsed_time)}>
          {log.elapsed_time} ms
        </Label>
      )}
      {log.is_stream && (
        <Label size='mini' color='pink'>Stream</Label>
      )}
      {log.system_prompt_reset && (
        <Label basic size='mini' color='red'>System Prompt Reset</Label>
      )}
    </>
  );
}

const LogDetailModal = ({ log, open, onClose, t }) => {
  if (!log) return null;
  return (
    <Modal open={open} onClose={onClose} size='small' className='log-detail-modal'>
      <Modal.Header style={{ color: '#2B3674' }}>
        <Icon name='file alternate outline' /> 日志详情
      </Modal.Header>
      <Modal.Content>
        <div style={{ padding: '8px 0' }}>
          <div className='log-detail-item'>
            <span className='log-detail-label'>请求 ID</span>
            <span className='log-detail-value'>
              <code style={{ cursor: 'pointer' }} onClick={async () => {
                if (await copy(log.request_id)) showSuccess('已复制请求 ID');
              }}>
                {log.request_id || '—'}
              </code>
            </span>
          </div>
          <div className='log-detail-item'>
            <span className='log-detail-label'>时间</span>
            <span className='log-detail-value'>{timestamp2string(log.created_at)}</span>
          </div>
          <div className='log-detail-item'>
            <span className='log-detail-label'>类型</span>
            <span className='log-detail-value'>{renderType(log.type)} {getTypeName(log.type)}</span>
          </div>
          <div className='log-detail-item'>
            <span className='log-detail-label'>用户</span>
            <span className='log-detail-value'>{log.username || '—'}</span>
          </div>
          <div className='log-detail-item'>
            <span className='log-detail-label'>模型</span>
            <span className='log-detail-value'>{log.model_name ? renderColorLabel(log.model_name) : '—'}</span>
          </div>
          <div className='log-detail-item'>
            <span className='log-detail-label'>令牌名称</span>
            <span className='log-detail-value'>{log.token_name || '—'}</span>
          </div>
          <div className='log-detail-item'>
            <span className='log-detail-label'>渠道 ID</span>
            <span className='log-detail-value'>{log.channel || '—'}</span>
          </div>

          <Header as='h4' dividing style={{ marginTop: 16, color: '#2B3674' }}>
            Token 用量
          </Header>
          <Grid columns={3} stackable>
            <Grid.Column>
              <Segment textAlign='center' style={{ borderRadius: 12 }}>
                <div style={{ fontSize: '0.85em', color: '#A3AED0' }}>Prompt Tokens</div>
                <div style={{ fontSize: '1.4em', fontWeight: 700, color: '#6C63FF' }}>
                  {log.prompt_tokens || 0}
                </div>
              </Segment>
            </Grid.Column>
            <Grid.Column>
              <Segment textAlign='center' style={{ borderRadius: 12 }}>
                <div style={{ fontSize: '0.85em', color: '#A3AED0' }}>Completion Tokens</div>
                <div style={{ fontSize: '1.4em', fontWeight: 700, color: '#FF5E7D' }}>
                  {log.completion_tokens || 0}
                </div>
              </Segment>
            </Grid.Column>
            <Grid.Column>
              <Segment textAlign='center' style={{ borderRadius: 12 }}>
                <div style={{ fontSize: '0.85em', color: '#A3AED0' }}>总 Token</div>
                <div style={{ fontSize: '1.4em', fontWeight: 700, color: '#4318FF' }}>
                  {(log.prompt_tokens || 0) + (log.completion_tokens || 0)}
                </div>
              </Segment>
            </Grid.Column>
          </Grid>

          <Header as='h4' dividing style={{ marginTop: 16, color: '#2B3674' }}>
            性能 & 额度
          </Header>
          <div className='log-detail-item'>
            <span className='log-detail-label'>耗时</span>
            <span className='log-detail-value'>
              {log.elapsed_time ? (
                <Label basic size='small' color={getColorByElapsedTime(log.elapsed_time)}>
                  {log.elapsed_time} ms
                </Label>
              ) : '—'}
            </span>
          </div>
          <div className='log-detail-item'>
            <span className='log-detail-label'>消耗额度</span>
            <span className='log-detail-value'>
              {log.quota ? renderQuota(log.quota, t, 6) : '—'}
            </span>
          </div>
          <div className='log-detail-item'>
            <span className='log-detail-label'>流式输出</span>
            <span className='log-detail-value'>
              {log.is_stream ? <Label size='mini' color='pink'>是</Label> : '否'}
            </span>
          </div>

          <Header as='h4' dividing style={{ marginTop: 16, color: '#2B3674' }}>
            详情
          </Header>
          <Segment style={{ borderRadius: 12, background: '#f9f9fb', wordBreak: 'break-all' }}>
            {log.content || '无详情'}
          </Segment>
        </div>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>关闭</Button>
      </Modal.Actions>
    </Modal>
  );
};

const LogsTable = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [showStat, setShowStat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [logType, setLogType] = useState(0);
  const [detailLog, setDetailLog] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const isAdminUser = isAdmin();
  let now = new Date();
  const [inputs, setInputs] = useState({
    username: '',
    token_name: '',
    model_name: '',
    start_timestamp: timestamp2string(0),
    end_timestamp: timestamp2string(now.getTime() / 1000 + 3600),
    channel: '',
  });
  const {
    username,
    token_name,
    model_name,
    start_timestamp,
    end_timestamp,
    channel,
  } = inputs;

  const [stat, setStat] = useState({
    quota: 0,
    token: 0,
  });

  const LOG_OPTIONS = [
    { key: '0', text: t('log.type.all'), value: 0 },
    { key: '1', text: t('log.type.topup'), value: 1 },
    { key: '2', text: t('log.type.usage'), value: 2 },
    { key: '3', text: t('log.type.admin'), value: 3 },
    { key: '4', text: t('log.type.system'), value: 4 },
    { key: '5', text: t('log.type.test'), value: 5 },
  ];

  const handleInputChange = (e, { name, value }) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };

  const getLogSelfStat = async () => {
    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    let res = await API.get(
      `/api/log/self/stat?type=${logType}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`
    );
    const { success, message, data } = res.data;
    if (success) {
      setStat(data);
    } else {
      showError(message);
    }
  };

  const getLogStat = async () => {
    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    let res = await API.get(
      `/api/log/stat?type=${logType}&username=${username}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&channel=${channel}`
    );
    const { success, message, data } = res.data;
    if (success) {
      setStat(data);
    } else {
      showError(message);
    }
  };

  const handleEyeClick = async () => {
    if (!showStat) {
      if (isAdminUser) {
        await getLogStat();
      } else {
        await getLogSelfStat();
      }
    }
    setShowStat(!showStat);
  };

  const showUserTokenQuota = () => {
    return logType !== 5;
  };

  const loadLogs = async (startIdx) => {
    let url = '';
    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    if (isAdminUser) {
      url = `/api/log/?p=${startIdx}&type=${logType}&username=${username}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&channel=${channel}`;
    } else {
      url = `/api/log/self/?p=${startIdx}&type=${logType}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`;
    }
    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      if (startIdx === 0) {
        setLogs(data);
      } else {
        let newLogs = [...logs];
        newLogs.splice(startIdx * ITEMS_PER_PAGE, data.length, ...data);
        setLogs(newLogs);
      }
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const onPaginationChange = (e, { activePage }) => {
    (async () => {
      if (activePage === Math.ceil(logs.length / ITEMS_PER_PAGE) + 1) {
        await loadLogs(activePage - 1);
      }
      setActivePage(activePage);
    })();
  };

  const refresh = async () => {
    setLoading(true);
    setActivePage(1);
    await loadLogs(0);
  };

  useEffect(() => {
    refresh().then();
  }, [logType]);

  const searchLogs = async () => {
    if (searchKeyword === '') {
      await loadLogs(0);
      setActivePage(1);
      return;
    }
    setSearching(true);
    const res = await API.get(`/api/log/self/search?keyword=${searchKeyword}`);
    const { success, message, data } = res.data;
    if (success) {
      setLogs(data);
      setActivePage(1);
    } else {
      showError(message);
    }
    setSearching(false);
  };

  const handleKeywordChange = async (e, { value }) => {
    setSearchKeyword(value.trim());
  };

  const sortLog = (key) => {
    if (logs.length === 0) return;
    setLoading(true);
    let sortedLogs = [...logs];
    if (typeof sortedLogs[0][key] === 'string') {
      sortedLogs.sort((a, b) => {
        return ('' + a[key]).localeCompare(b[key]);
      });
    } else {
      sortedLogs.sort((a, b) => {
        if (a[key] === b[key]) return 0;
        if (a[key] > b[key]) return -1;
        if (a[key] < b[key]) return 1;
      });
    }
    if (sortedLogs[0].id === logs[0].id) {
      sortedLogs.reverse();
    }
    setLogs(sortedLogs);
    setLoading(false);
  };

  const openDetailModal = (log) => {
    setDetailLog(log);
    setDetailOpen(true);
  };

  return (
    <>
      <LogDetailModal
        log={detailLog}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        t={t}
      />

      <Header as='h3'>
        {t('log.usage_details')}（{t('log.total_quota')}：
        {showStat && renderQuota(stat.quota, t)}
        {!showStat && (
          <span onClick={handleEyeClick} style={{ cursor: 'pointer', color: 'gray' }}>
            {t('log.click_to_view')}
          </span>
        )}
        ）
      </Header>
      <Form>
        <Form.Group>
          <Form.Input
            fluid
            label={t('log.table.token_name')}
            size='small'
            width={3}
            value={token_name}
            placeholder={t('log.table.token_name_placeholder')}
            name='token_name'
            onChange={handleInputChange}
          />
          <Form.Input
            fluid
            label={t('log.table.model_name')}
            size='small'
            width={3}
            value={model_name}
            placeholder={t('log.table.model_name_placeholder')}
            name='model_name'
            onChange={handleInputChange}
          />
          <Form.Input
            fluid
            label={t('log.table.start_time')}
            size='small'
            width={4}
            value={start_timestamp}
            type='datetime-local'
            name='start_timestamp'
            onChange={handleInputChange}
          />
          <Form.Input
            fluid
            label={t('log.table.end_time')}
            size='small'
            width={4}
            value={end_timestamp}
            type='datetime-local'
            name='end_timestamp'
            onChange={handleInputChange}
          />
          <Form.Button
            fluid
            label={t('log.buttons.query')}
            size='small'
            width={2}
            onClick={refresh}
          >
            {t('log.buttons.submit')}
          </Form.Button>
        </Form.Group>
        {isAdminUser && (
          <Form.Group>
            <Form.Input
              fluid
              label={t('log.table.channel_id')}
              size='small'
              width={3}
              value={channel}
              placeholder={t('log.table.channel_id_placeholder')}
              name='channel'
              onChange={handleInputChange}
            />
            <Form.Input
              fluid
              label={t('log.table.username')}
              size='small'
              width={3}
              value={username}
              placeholder={t('log.table.username_placeholder')}
              name='username'
              onChange={handleInputChange}
            />
          </Form.Group>
        )}
      </Form>
      <Table basic='very' compact size='small'>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell style={{ cursor: 'pointer' }} onClick={() => sortLog('created_time')} width={3}>
              {t('log.table.time')}
            </Table.HeaderCell>
            {isAdminUser && (
              <Table.HeaderCell style={{ cursor: 'pointer' }} onClick={() => sortLog('channel')} width={1}>
                {t('log.table.channel')}
              </Table.HeaderCell>
            )}
            <Table.HeaderCell style={{ cursor: 'pointer' }} onClick={() => sortLog('type')} width={1}>
              {t('log.table.type')}
            </Table.HeaderCell>
            <Table.HeaderCell style={{ cursor: 'pointer' }} onClick={() => sortLog('model_name')} width={2}>
              {t('log.table.model')}
            </Table.HeaderCell>
            {showUserTokenQuota() && (
              <>
                {isAdminUser && (
                  <Table.HeaderCell style={{ cursor: 'pointer' }} onClick={() => sortLog('username')} width={2}>
                    {t('log.table.username')}
                  </Table.HeaderCell>
                )}
                <Table.HeaderCell style={{ cursor: 'pointer' }} onClick={() => sortLog('token_name')} width={2}>
                  {t('log.table.token_name')}
                </Table.HeaderCell>
                <Table.HeaderCell style={{ cursor: 'pointer' }} onClick={() => sortLog('prompt_tokens')} width={1}>
                  {t('log.table.prompt_tokens')}
                </Table.HeaderCell>
                <Table.HeaderCell style={{ cursor: 'pointer' }} onClick={() => sortLog('completion_tokens')} width={1}>
                  {t('log.table.completion_tokens')}
                </Table.HeaderCell>
                <Table.HeaderCell style={{ cursor: 'pointer' }} onClick={() => sortLog('quota')} width={1}>
                  {t('log.table.quota')}
                </Table.HeaderCell>
              </>
            )}
            <Table.HeaderCell>{t('log.table.detail')}</Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {logs
            .slice(
              (activePage - 1) * ITEMS_PER_PAGE,
              activePage * ITEMS_PER_PAGE
            )
            .map((log, idx) => {
              if (log.deleted) return <></>;
              return (
                <Table.Row key={log.id} style={{ cursor: 'pointer' }} onClick={() => openDetailModal(log)}>
                  <Table.Cell>
                    {renderTimestamp(log.created_at, log.request_id)}
                  </Table.Cell>
                  {isAdminUser && (
                    <Table.Cell>
                      {log.channel ? (
                        <Label basic as={Link} to={`/channel/edit/${log.channel}`} onClick={(e) => e.stopPropagation()}>
                          {log.channel}
                        </Label>
                      ) : ''}
                    </Table.Cell>
                  )}
                  <Table.Cell>{renderType(log.type)}</Table.Cell>
                  <Table.Cell>
                    {log.model_name ? renderColorLabel(log.model_name) : ''}
                  </Table.Cell>
                  {showUserTokenQuota() && (
                    <>
                      {isAdminUser && (
                        <Table.Cell>
                          {log.username ? (
                            <Label basic as={Link} to={`/user/edit/${log.user_id}`} onClick={(e) => e.stopPropagation()}>
                              {log.username}
                            </Label>
                          ) : ''}
                        </Table.Cell>
                      )}
                      <Table.Cell>
                        {log.token_name ? renderColorLabel(log.token_name) : ''}
                      </Table.Cell>
                      <Table.Cell>
                        {log.prompt_tokens ? log.prompt_tokens : ''}
                      </Table.Cell>
                      <Table.Cell>
                        {log.completion_tokens ? log.completion_tokens : ''}
                      </Table.Cell>
                      <Table.Cell>
                        {log.quota ? renderQuota(log.quota, t, 6) : ''}
                      </Table.Cell>
                    </>
                  )}
                  <Table.Cell>{renderDetail(log)}</Table.Cell>
                </Table.Row>
              );
            })}
        </Table.Body>

        <Table.Footer>
          <Table.Row>
            <Table.HeaderCell colSpan='10'>
              <Select
                placeholder={t('log.type.select')}
                options={LOG_OPTIONS}
                style={{ marginRight: '8px' }}
                name='logType'
                value={logType}
                onChange={(e, { name, value }) => setLogType(value)}
              />
              <Button size='small' onClick={refresh} loading={loading}>
                {t('log.buttons.refresh')}
              </Button>
              <Pagination
                floated='right'
                activePage={activePage}
                onPageChange={onPaginationChange}
                size='small'
                siblingRange={1}
                totalPages={
                  Math.ceil(logs.length / ITEMS_PER_PAGE) +
                  (logs.length % ITEMS_PER_PAGE === 0 ? 1 : 0)
                }
              />
            </Table.HeaderCell>
          </Table.Row>
        </Table.Footer>
      </Table>
    </>
  );
};

export default LogsTable;
