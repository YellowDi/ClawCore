# ClawCore

ClawCore 是 ClawPro/OpenClaw 自定义通道链路里的轻量 Go 桥接服务。它承担 ClawPro 所需的“企业 IM 服务”角色：

- ClawBridge 浏览器端通过 WebSocket 连接 ClawCore。
- OpenClaw 通过 `openclaw-plugin-clawbridge` 适配插件连接 ClawCore。
- OpenClaw 回复通过 HTTP 回调写回 ClawCore，再广播给 ClawBridge。

## 运行 ClawCore

```sh
brew install go
go run ./cmd/clawcore
```

Default local address:

```text
http://127.0.0.1:8080
```

## 环境变量

```sh
CLAWCORE_ADDR=:8080
CLAWCORE_BRIDGE_TOKEN=
CLAWCORE_OPENCLAW_TOKEN=
CLAWCORE_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

`CLAWCORE_ALLOWED_ORIGINS=*` 只建议用于本地测试或可信网络。

## 接口

- `GET /healthz`
- `GET /ws/browser?conversation_id=main&token=<CLAWCORE_BRIDGE_TOKEN>`
- `GET /ws/openclaw?bot_id=<botId>&token=<CLAWCORE_OPENCLAW_TOKEN>`
- `POST /api/openclaw/messages`

OpenClaw HTTP reply example:

```json
{
  "conversationId": "main",
  "replyTo": "user-message-id",
  "messageId": "assistant-message-id",
  "text": "hello",
  "state": "final"
}
```

## OpenClaw 适配插件

真实 OpenClaw 适配插件位于：

```text
openclaw-plugin-clawbridge/
```

构建：

```sh
cd openclaw-plugin-clawbridge
npm install
npm run build
```

OpenClaw channel 配置示例：

```jsonc
{
  "channels": {
    "clawbridge": {
      "enabled": true,
      "serverUrl": "https://<domain>",
      "webSocketUrl": "wss://<domain>/ws/openclaw",
      "botId": "clawbridge",
      "botToken": "<same-as-CLAWCORE_OPENCLAW_TOKEN>",
      "agentId": "default",
      "defaultTo": "main",
      "allowFrom": ["*"]
    }
  }
}
```

本机当前 Node 是 `22.14.0`，OpenClaw `2026.5.18` 声明运行时需要 `>=22.19.0`。插件已经通过 TypeScript 编译，但真实加载 OpenClaw 前需要升级 Node。

## Mock OpenClaw 烟测

一个终端启动服务：

```sh
CLAWCORE_BRIDGE_TOKEN=dev-bridge CLAWCORE_OPENCLAW_TOKEN=dev-openclaw go run ./cmd/clawcore
```

另一个终端启动模拟 OpenClaw 客户端：

```sh
CLAWCORE_OPENCLAW_TOKEN=dev-openclaw go run ./cmd/clawmock
```

然后让 ClawBridge 连接：

```text
ws://127.0.0.1:8080/ws/browser?conversation_id=main&token=dev-bridge
```

## ClawPro 自定义通道

- Channel ID: `clawbridge`
- Server URL: `https://<domain>`
- WebSocket URL: `wss://<domain>/ws/openclaw`
- Credential fields: `botId`, `botToken`

TLS 由 Go 服务前面的反向代理或隧道终止，ClawCore 本身保持本地 HTTP 即可。
