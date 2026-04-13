# LiteNova999: Custom One-API build
# Features: passthrough routing, health checks, smart fallback, custom frontend

# Stage 1: Build the custom frontend
FROM node:16 AS frontend-builder
WORKDIR /web
COPY ./web-src/web /web
RUN npm install
RUN DISABLE_ESLINT_PLUGIN='true' REACT_APP_VERSION='litenova-1.0.0' npm run build

# Stage 2: Build Go binary with custom modifications
FROM golang:alpine AS go-builder

RUN apk add --no-cache gcc musl-dev sqlite-dev build-base git

ENV GO111MODULE=on \
    CGO_ENABLED=1 \
    GOOS=linux

WORKDIR /build

# Clone One-API source
RUN git clone --depth 1 https://github.com/songquanpeng/one-api.git .

# Overlay custom backend code
COPY ./backend/custom/monitor/health.go ./monitor/health.go
COPY ./backend/custom/model/channel_select.go ./model/channel_select.go
COPY ./backend/custom/controller/health.go ./controller/health.go
COPY ./backend/custom/controller/passthrough.go ./controller/passthrough.go
COPY ./backend/custom/controller/relay.go ./controller/relay.go
COPY ./backend/custom/relay/adaptor/passthrough/ ./relay/adaptor/passthrough/
COPY ./backend/custom/router/relay.go ./router/relay.go
COPY ./backend/custom/router/api.go ./router/api.go

# Copy custom frontend build
COPY --from=frontend-builder /web/build ./web/build

# Download Go dependencies
RUN go mod download

# Build
RUN go build -trimpath \
    -ldflags "-s -w -X 'github.com/songquanpeng/one-api/common.Version=litenova-1.0.0' -linkmode external -extldflags '-static'" \
    -o one-api

# Stage 3: Final runtime image
FROM alpine:latest

RUN apk add --no-cache ca-certificates tzdata curl

COPY --from=go-builder /build/one-api /one-api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/status || exit 1

WORKDIR /data
ENTRYPOINT ["/one-api"]
