# 千问 API 中转平台 — 部署配置

## docker-compose.yml

```yaml
version: '3.8'

services:
  one-api:
    image: justsong/one-api:latest
    container_name: one-api
    restart: always
    ports:
      - "3000:3000"
    environment:
      - SQL_DSN=postgres://oneapi:${POSTGRES_PASSWORD}@db:5432/oneapi?sslmode=disable
      - REDIS_CONN_STRING=redis://redis:6379
      - SESSION_SECRET=${SESSION_SECRET}
      - TZ=Asia/Shanghai
    depends_on:
      - db
      - redis
    volumes:
      - one-api-data:/data

  db:
    image: postgres:14-alpine
    container_name: one-api-db
    restart: always
    environment:
      - POSTGRES_USER=oneapi
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=oneapi
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U oneapi"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: one-api-redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    container_name: one-api-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - one-api

volumes:
  one-api-data:
  postgres-data:
  redis-data:
```

## .env 模板

```env
POSTGRES_PASSWORD=<随机生成>
REDIS_PASSWORD=<随机生成>
SESSION_SECRET=<随机生成>
DOMAIN=<阿哲提供域名>
```

## Nginx 配置模板 (nginx/conf.d/default.conf)

```nginx
upstream oneapi {
    server one-api:3000;
}

server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # DDoS 基础防护
    limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
    limit_req_zone $binary_remote_addr zone=req_limit:10m rate=100r/s;

    limit_conn conn_limit 100;
    limit_req zone=req_limit burst=200 nodelay;

    location / {
        proxy_pass http://oneapi;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Stream 支持
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
        proxy_read_timeout 300s;
    }

    # 健康检查
    location /api/health {
        proxy_pass http://oneapi;
        access_log off;
    }
}
```

## 部署步骤

1. SSH 登录 ECS
2. 安装 Docker + Docker Compose
3. 创建项目目录，放入 docker-compose.yml + .env + nginx 配置
4. 生成 SSL 证书（Let's Encrypt certbot）
5. `docker-compose up -d`
6. 访问 https://<domain> 初始化管理员账号
7. 配置千问渠道（BE-002）
