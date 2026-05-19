# OpenClaw ClawBridge Channel Plugin

这个插件把 OpenClaw 的原生 channel 运行时接到 ClawCore：

- 入站：ClawCore `/ws/openclaw` 收到 ClawBridge 用户消息后，插件交给 OpenClaw agent 运行时处理。
- 出站：OpenClaw 的回复通过 `POST /api/openclaw/messages` 回写 ClawCore，再由 ClawCore 推给 ClawBridge 浏览器端。

## 本地构建

```bash
npm install
npm run build
```

## OpenClaw 配置示例

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

ClawCore 本地运行 HTTP 即可，公网 TLS/WSS 仍由反向代理或隧道负责终止。
