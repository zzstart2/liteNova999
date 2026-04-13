import React, { useState } from 'react';
import {
  Grid,
  Menu,
  Segment,
  Header,
  Icon,
  Label,
  Input,
  Accordion,
  Button,
  Form,
  TextArea,
  Message,
  Tab,
} from 'semantic-ui-react';
import './ApiDocs.css';

const ENDPOINTS = [
  {
    category: 'Chat',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/chat/completions',
        title: 'Chat Completions',
        description: '创建聊天补全。支持流式和非流式响应。',
        params: [
          { name: 'model', type: 'string', required: true, desc: '模型名称，如 qwen-turbo, qwen-max' },
          { name: 'messages', type: 'array', required: true, desc: '对话消息数组' },
          { name: 'stream', type: 'boolean', required: false, desc: '是否流式输出' },
          { name: 'temperature', type: 'number', required: false, desc: '采样温度 0-2' },
          { name: 'max_tokens', type: 'integer', required: false, desc: '最大输出 token 数' },
        ],
      },
    ],
  },
  {
    category: 'Embeddings',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/embeddings',
        title: 'Embeddings',
        description: '将文本转换为向量表示。',
        params: [
          { name: 'model', type: 'string', required: true, desc: '嵌入模型名称' },
          { name: 'input', type: 'string|array', required: true, desc: '输入文本' },
        ],
      },
    ],
  },
  {
    category: 'Images',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/images/generations',
        title: 'Image Generation',
        description: '根据文本描述生成图片。',
        params: [
          { name: 'model', type: 'string', required: true, desc: '图像模型名称' },
          { name: 'prompt', type: 'string', required: true, desc: '图片描述' },
          { name: 'size', type: 'string', required: false, desc: '图片尺寸' },
        ],
      },
    ],
  },
  {
    category: 'Passthrough',
    endpoints: [
      {
        method: 'ANY',
        path: '/passthrough/*',
        title: 'Native API Passthrough',
        description: '透传模式：请求将原样转发到上游 Provider，支持厂商特有 API。',
        params: [
          { name: 'Authorization', type: 'header', required: true, desc: 'Bearer sk-xxx (平台 Token)' },
        ],
      },
    ],
  },
  {
    category: 'Models',
    endpoints: [
      {
        method: 'GET',
        path: '/v1/models',
        title: 'List Models',
        description: '列出可用模型。',
        params: [],
      },
    ],
  },
];

const generateCurl = (endpoint, apiKey, baseUrl) => {
  const url = `${baseUrl}${endpoint.path}`;
  if (endpoint.method === 'GET') {
    return `curl "${url}" \\
  -H "Authorization: Bearer ${apiKey}"`;
  }
  if (endpoint.path.includes('/chat/completions')) {
    return `curl "${url}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "qwen-turbo",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`;
  }
  return `curl -X ${endpoint.method} "${url}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{}'`;
};

const generatePython = (endpoint, apiKey, baseUrl) => {
  if (endpoint.path.includes('/chat/completions')) {
    return `from openai import OpenAI

client = OpenAI(
    api_key="${apiKey}",
    base_url="${baseUrl}/v1"
)

response = client.chat.completions.create(
    model="qwen-turbo",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)
print(response.choices[0].message.content)`;
  }
  return `import requests

response = requests.${endpoint.method.toLowerCase()}(
    "${baseUrl}${endpoint.path}",
    headers={"Authorization": "Bearer ${apiKey}"},
    json={}
)
print(response.json())`;
};

const generateJS = (endpoint, apiKey, baseUrl) => {
  if (endpoint.path.includes('/chat/completions')) {
    return `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '${apiKey}',
  baseURL: '${baseUrl}/v1',
});

const response = await client.chat.completions.create({
  model: 'qwen-turbo',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(response.choices[0].message.content);`;
  }
  return `const response = await fetch('${baseUrl}${endpoint.path}', {
  method: '${endpoint.method}',
  headers: {
    'Authorization': 'Bearer ${apiKey}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({}),
});
const data = await response.json();
console.log(data);`;
};

const MethodBadge = ({ method }) => {
  const colorMap = { GET: 'green', POST: 'blue', PUT: 'orange', DELETE: 'red', ANY: 'purple' };
  return <Label color={colorMap[method] || 'grey'} size="small">{method}</Label>;
};

const ApiDocs = () => {
  const [activeCategory, setActiveCategory] = useState(0);
  const [activeEndpoint, setActiveEndpoint] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiKey, setApiKey] = useState('sk-your-api-key');
  const [baseUrl, setBaseUrl] = useState(window.location.origin);
  const [playgroundBody, setPlaygroundBody] = useState('');
  const [playgroundResponse, setPlaygroundResponse] = useState('');
  const [playgroundLoading, setPlaygroundLoading] = useState(false);

  const filteredEndpoints = ENDPOINTS.map((cat) => ({
    ...cat,
    endpoints: cat.endpoints.filter(
      (ep) =>
        ep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.path.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((cat) => cat.endpoints.length > 0);

  const currentEndpoint = activeEndpoint ||
    (filteredEndpoints[0]?.endpoints[0]);

  const handleTryIt = async () => {
    if (!currentEndpoint) return;
    setPlaygroundLoading(true);
    setPlaygroundResponse('');
    try {
      const url = `${baseUrl}${currentEndpoint.path}`;
      const options = {
        method: currentEndpoint.method === 'GET' ? 'GET' : 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      };
      if (currentEndpoint.method !== 'GET' && playgroundBody) {
        options.body = playgroundBody;
      }
      const resp = await fetch(url, options);
      const data = await resp.json();
      setPlaygroundResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setPlaygroundResponse(`Error: ${err.message}`);
    } finally {
      setPlaygroundLoading(false);
    }
  };

  const codePanes = currentEndpoint
    ? [
        {
          menuItem: 'cURL',
          render: () => (
            <Tab.Pane>
              <pre className="code-block">{generateCurl(currentEndpoint, apiKey, baseUrl)}</pre>
            </Tab.Pane>
          ),
        },
        {
          menuItem: 'Python',
          render: () => (
            <Tab.Pane>
              <pre className="code-block">{generatePython(currentEndpoint, apiKey, baseUrl)}</pre>
            </Tab.Pane>
          ),
        },
        {
          menuItem: 'JavaScript',
          render: () => (
            <Tab.Pane>
              <pre className="code-block">{generateJS(currentEndpoint, apiKey, baseUrl)}</pre>
            </Tab.Pane>
          ),
        },
      ]
    : [];

  return (
    <div className="api-docs-container">
      <Header as="h2">
        <Icon name="book" />
        <Header.Content>
          API 文档
          <Header.Subheader>兼容 OpenAI SDK，支持千问全系列模型</Header.Subheader>
        </Header.Content>
      </Header>

      {/* Auth Info */}
      <Message info>
        <Message.Header>认证方式</Message.Header>
        <p>
          所有请求需携带 <code>Authorization: Bearer sk-xxx</code> 头部。
          在 <a href="/token">Token 管理</a> 页面创建 API Key。
        </p>
        <Form>
          <Form.Group widths="equal">
            <Form.Input
              label="API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
            <Form.Input
              label="Base URL"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </Form.Group>
        </Form>
      </Message>

      <Grid>
        {/* Sidebar */}
        <Grid.Column width={4}>
          <Input
            icon="search"
            placeholder="搜索 API..."
            fluid
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <Menu vertical fluid>
            {filteredEndpoints.map((cat, ci) => (
              <React.Fragment key={cat.category}>
                <Menu.Item header>{cat.category}</Menu.Item>
                {cat.endpoints.map((ep) => (
                  <Menu.Item
                    key={ep.path}
                    active={currentEndpoint?.path === ep.path}
                    onClick={() => {
                      setActiveEndpoint(ep);
                      setActiveCategory(ci);
                      setPlaygroundResponse('');
                      if (ep.path.includes('/chat/completions')) {
                        setPlaygroundBody(
                          JSON.stringify(
                            { model: 'qwen-turbo', messages: [{ role: 'user', content: 'Hello!' }] },
                            null,
                            2
                          )
                        );
                      } else {
                        setPlaygroundBody('{}');
                      }
                    }}
                  >
                    <MethodBadge method={ep.method} /> {ep.title}
                  </Menu.Item>
                ))}
              </React.Fragment>
            ))}
          </Menu>
        </Grid.Column>

        {/* Main Content */}
        <Grid.Column width={12}>
          {currentEndpoint && (
            <>
              <Segment>
                <Header as="h3">
                  <MethodBadge method={currentEndpoint.method} />
                  <code style={{ marginLeft: 8 }}>{currentEndpoint.path}</code>
                </Header>
                <p>{currentEndpoint.description}</p>

                {/* Parameters */}
                {currentEndpoint.params.length > 0 && (
                  <>
                    <Header as="h4">参数</Header>
                    <table className="ui celled table small">
                      <thead>
                        <tr>
                          <th>名称</th>
                          <th>类型</th>
                          <th>必填</th>
                          <th>说明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentEndpoint.params.map((p) => (
                          <tr key={p.name}>
                            <td><code>{p.name}</code></td>
                            <td><Label size="mini">{p.type}</Label></td>
                            <td>{p.required ? <Icon name="check" color="green" /> : '-'}</td>
                            <td>{p.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </Segment>

              {/* Code Examples */}
              <Segment>
                <Header as="h4">代码示例</Header>
                <Tab panes={codePanes} />
              </Segment>

              {/* Playground */}
              <Segment>
                <Header as="h4">
                  <Icon name="play" /> Playground
                </Header>
                {currentEndpoint.method !== 'GET' && (
                  <Form style={{ marginBottom: 12 }}>
                    <TextArea
                      rows={6}
                      value={playgroundBody}
                      onChange={(e) => setPlaygroundBody(e.target.value)}
                      placeholder="Request Body (JSON)"
                      style={{ fontFamily: 'monospace', fontSize: 13 }}
                    />
                  </Form>
                )}
                <Button
                  primary
                  onClick={handleTryIt}
                  loading={playgroundLoading}
                  content="发送请求"
                  icon="send"
                />
                {playgroundResponse && (
                  <pre className="code-block response-block">{playgroundResponse}</pre>
                )}
              </Segment>
            </>
          )}
        </Grid.Column>
      </Grid>
    </div>
  );
};

export default ApiDocs;
