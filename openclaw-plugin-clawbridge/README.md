# OpenClaw ClawBridge Channel Plugin

这个插件把 OpenClaw 2026.4.23 的原生 channel runtime 接到 ClawPro/ClawCore IM：

- 入站：插件通过 `wsUrl` 连接 `/ws/channel`，收到 `user.message` 后交给 OpenClaw agent runtime。
- 出站：OpenClaw 回复通过 `POST /api/channels/clawbridge/messages` 回写 ClawCore/IM。
- 插件形态只声明 channel capability，不注册 provider。

## 本地构建

```sh
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
      "wsUrl": "wss://<domain>/ws/channel",
      "token": "<same-as-CLAWCORE_CHANNEL_TOKEN>",
      "agentId": "default",
      "defaultTo": "main",
      "allowFrom": ["*"],
      "reconnectMs": 1500
    }
  }
}
```

Channel ID 固定为 `clawbridge`，同时用于插件 id、manifest `channels[]`、配置路径 `channels.clawbridge` 和运行时路由 channel。

ClawCore 本地运行 HTTP 即可，公网 TLS/WSS 由反向代理或隧道负责终止。
