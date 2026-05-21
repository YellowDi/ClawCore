package bridge

import "time"

const (
	// 以下消息类型组成 ClawBridge、ClawCore 和 channel 客户端之间的轻量线协议。
	MessageTypeConnectionReady = "connection.ready"
	MessageTypeUserMessage     = "user.message"
	MessageTypeAssistant       = "assistant.message"
	MessageTypeError           = "error"

	StateDelta = "delta"
	StateFinal = "final"
	StateError = "error"
)

// BrowserInboundMessage 表示 ClawBridge 发送到 ClawCore 的用户消息帧。
type BrowserInboundMessage struct {
	Type           string         `json:"type"`
	ID             string         `json:"id,omitempty"`
	ConversationID string         `json:"conversationId,omitempty"`
	Text           string         `json:"text,omitempty"`
	CreatedAt      string         `json:"createdAt,omitempty"`
	Metadata       map[string]any `json:"metadata,omitempty"`
}

// ChannelMessage 表示 channel 侧的双向消息帧：user.message 发给插件，assistant.message 返回给 ClawCore。
type ChannelMessage struct {
	Type           string         `json:"type"`
	ID             string         `json:"id,omitempty"`
	ConversationID string         `json:"conversationId,omitempty"`
	Text           string         `json:"text,omitempty"`
	ReplyTo        string         `json:"replyTo,omitempty"`
	MessageID      string         `json:"messageId,omitempty"`
	State          string         `json:"state,omitempty"`
	CreatedAt      string         `json:"createdAt,omitempty"`
	Metadata       map[string]any `json:"metadata,omitempty"`
}

// AssistantMessage 是 ClawCore 广播给浏览器的标准助手消息帧。
type AssistantMessage struct {
	Type           string         `json:"type"`
	MessageID      string         `json:"messageId"`
	ConversationID string         `json:"conversationId"`
	ReplyTo        string         `json:"replyTo,omitempty"`
	Text           string         `json:"text"`
	State          string         `json:"state"`
	CreatedAt      string         `json:"createdAt"`
	Metadata       map[string]any `json:"metadata,omitempty"`
}

// ErrorMessage 表示 ClawCore 发送给浏览器或 channel 客户端的错误帧。
type ErrorMessage struct {
	Type           string `json:"type"`
	ConversationID string `json:"conversationId,omitempty"`
	ReplyTo        string `json:"replyTo,omitempty"`
	Code           string `json:"code"`
	Message        string `json:"message"`
	CreatedAt      string `json:"createdAt"`
}

// HealthResponse 是健康检查接口的响应体。
type HealthResponse struct {
	OK        bool   `json:"ok"`
	Service   string `json:"service"`
	Timestamp string `json:"timestamp"`
}

// DeliveryResponse 是 channel HTTP 回传接口的投递结果。
type DeliveryResponse struct {
	OK        bool `json:"ok"`
	Delivered int  `json:"delivered"`
}

func nowRFC3339() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}
