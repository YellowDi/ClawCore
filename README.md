# ClawCore

ClawCore is a small Go bridge service for the ClawPro/OpenClaw custom-channel flow.
It behaves like the private IM service that ClawPro expects:

- ClawBridge connects to ClawCore through a browser WebSocket.
- OpenClaw or the current mock client connects to ClawCore through an OpenClaw WebSocket.
- OpenClaw replies can also be posted through the HTTP callback endpoint.

## Run

```sh
brew install go
go run ./cmd/clawcore
```

Default local address:

```text
http://127.0.0.1:8080
```

## Environment

```sh
CLAWCORE_ADDR=:8080
CLAWCORE_BRIDGE_TOKEN=
CLAWCORE_OPENCLAW_TOKEN=
CLAWCORE_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

Use `CLAWCORE_ALLOWED_ORIGINS=*` only for local testing or trusted networks.

## Endpoints

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

## Mock OpenClaw

Run the service in one terminal:

```sh
CLAWCORE_BRIDGE_TOKEN=dev-bridge CLAWCORE_OPENCLAW_TOKEN=dev-openclaw go run ./cmd/clawcore
```

Run the mock OpenClaw client in another terminal:

```sh
CLAWCORE_OPENCLAW_TOKEN=dev-openclaw go run ./cmd/clawmock
```

Then connect ClawBridge to:

```text
ws://127.0.0.1:8080/ws/browser?conversation_id=main&token=dev-bridge
```

## ClawPro Custom Channel Values

- Channel ID: `clawbridge`
- Server URL: `https://<domain>`
- WebSocket URL: `wss://<domain>/ws/openclaw`
- Credential fields: `botId`, `botToken`

TLS should be terminated by a reverse proxy or tunnel in front of this Go service.
