# ClawCore

ClawCore 是 ClawPro/OpenClaw 自定义 channel 链路里的轻量 IM 桥接服务：

- ClawBridge 浏览器端通过 WebSocket 连接 ClawCore。
- OpenClaw channel 插件通过 `wsUrl` 连接 ClawCore/IM 收取用户消息。
- OpenClaw 回复通过 channel HTTP 回调写回 ClawCore，再广播给 ClawBridge。

## 运行 ClawCore

```sh
brew install go
go run ./cmd/clawcore
```

默认本地地址：

```text
http://127.0.0.1:8080
```

## 环境变量

```sh
CLAWCORE_ADDR=:8080
CLAWCORE_BRIDGE_TOKEN=
CLAWCORE_CHANNEL_TOKEN=
CLAWCORE_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

`CLAWCORE_ALLOWED_ORIGINS=*` 只建议用于本地测试或可信网络。

## 接口

- `GET /healthz`
- `GET /ws/browser?token=<CLAWCORE_BRIDGE_TOKEN>`
- `GET /ws/channel?channel_id=clawbridge&account_id=default&token=<CLAWCORE_CHANNEL_TOKEN>`
- `POST /api/channels/clawbridge/messages`

Channel HTTP reply example:

```json
{
  "conversationId": "conv-...",
  "replyTo": "user-message-id",
  "messageId": "assistant-message-id",
  "text": "hello",
  "state": "final"
}
```

## OpenClaw Channel 插件

插件位于：

```text
openclaw-plugin-clawbridge/
```

构建：

```sh
cd openclaw-plugin-clawbridge
npm install
npm run build
```

OpenClaw/ClawPro channel 配置示例：

```jsonc
{
  "channels": {
    "clawbridge": {
      "enabled": true,
      "accounts": {
        "default": {
          "serverUrl": "https://<domain>",
          "wsUrl": "wss://<domain>/ws/channel",
          "token": "<same-as-CLAWCORE_CHANNEL_TOKEN>",
          "agentId": "default",
          "defaultTo": "main",
          "allowFrom": ["*"]
        }
      }
    }
  }
}
```

Channel ID 固定为 `clawbridge`，同时用于插件 id、manifest `channels[]`、配置路径 `channels.clawbridge` 和运行时路由 channel。连接参数必须放在 `channels.clawbridge.accounts.<accountId>` 下；`token` 是 ClawCore 当前使用的凭证字段，`accessKey` 可作为 token 兼容别名。

## Mock Channel 烟测

一个终端启动服务：

```sh
CLAWCORE_BRIDGE_TOKEN=dev-bridge CLAWCORE_CHANNEL_TOKEN=dev-channel go run ./cmd/clawcore
```

另一个终端启动模拟 channel 客户端：

```sh
CLAWCORE_CHANNEL_TOKEN=dev-channel go run ./cmd/clawmock
```

然后让 ClawBridge 连接：

```text
ws://127.0.0.1:8080/ws/browser?token=dev-bridge
```

浏览器 WebSocket 每次连接都会由 ClawCore 分配新的 `conversationId`，并在 `connection.ready` 帧里返回；ClawBridge 后续展示和消息关联应使用这个 id。

## ClawPro 自定义通道

- Channel ID: `clawbridge`
- Server URL: `https://<domain>`
- WebSocket URL: `wss://<domain>/ws/channel`
- Credential field: `token`

TLS 由 Go 服务前面的反向代理或隧道终止，ClawCore 本身保持本地 HTTP 即可。
