package bridge

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/coder/websocket"
)

const (
	defaultConversationID = "main"
	conversationIDPrefix  = "conv-"
	channelID             = "clawbridge"
)

// Server 封装 ClawCore 的 HTTP 路由、连接中心和日志输出。
type Server struct {
	cfg    Config
	hub    *Hub
	logger *log.Logger
}

// NewServer 创建 ClawCore HTTP 服务实例。
func NewServer(cfg Config, logger *log.Logger) *Server {
	if cfg.Addr == "" {
		cfg.Addr = ":8080"
	}
	if logger == nil {
		logger = log.Default()
	}
	return &Server{
		cfg:    cfg,
		hub:    NewHub(),
		logger: logger,
	}
}

// Handler 返回 ClawCore 的 HTTP 路由入口。
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.handleHealthz)
	mux.HandleFunc("GET /ws/browser", s.handleBrowserWebSocket)
	mux.HandleFunc("GET /ws/channel", s.handleChannelWebSocket)
	mux.HandleFunc("POST /api/channels/{channelID}/messages", s.handleChannelMessage)
	return s.withAccessLog(mux)
}

func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, HealthResponse{
		OK:        true,
		Service:   "clawcore",
		Timestamp: nowRFC3339(),
	})
}

func (s *Server) handleBrowserWebSocket(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r, s.cfg.BridgeToken) {
		http.Error(w, "invalid browser token", http.StatusUnauthorized)
		return
	}

	conversationID := newConversationID()

	conn, err := s.acceptWebSocket(w, r)
	if err != nil {
		s.logger.Printf("browser websocket accept failed: %v", err)
		return
	}

	client := NewWSClient(conn)
	s.hub.AddBrowser(conversationID, client)
	defer func() {
		s.hub.RemoveBrowser(conversationID, client)
		client.Close(websocket.StatusNormalClosure, "browser disconnected")
	}()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	go client.WriteLoop(ctx)

	// ClawBridge 收到 connection.ready 后，才允许输入框发送 user.message。
	client.Send(mustJSON(ChannelMessage{
		Type:           MessageTypeConnectionReady,
		ConversationID: conversationID,
		CreatedAt:      nowRFC3339(),
	}))

	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		if err := s.handleBrowserFrame(client, conversationID, data); err != nil {
			client.Send(mustJSON(ErrorMessage{
				Type:           MessageTypeError,
				ConversationID: conversationID,
				Code:           "BAD_REQUEST",
				Message:        err.Error(),
				CreatedAt:      nowRFC3339(),
			}))
		}
	}
}

func (s *Server) handleChannelWebSocket(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r, s.cfg.ChannelToken) {
		http.Error(w, "invalid channel token", http.StatusUnauthorized)
		return
	}
	if !s.validChannelID(r.URL.Query().Get("channel_id")) {
		http.Error(w, "invalid channel id", http.StatusBadRequest)
		return
	}

	conn, err := s.acceptWebSocket(w, r)
	if err != nil {
		s.logger.Printf("channel websocket accept failed: %v", err)
		return
	}

	client := NewWSClient(conn)
	s.hub.AddChannel(client)
	defer func() {
		s.hub.RemoveChannel(client)
		client.Close(websocket.StatusNormalClosure, "channel disconnected")
	}()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	go client.WriteLoop(ctx)

	client.Send(mustJSON(ChannelMessage{
		Type:      MessageTypeConnectionReady,
		CreatedAt: nowRFC3339(),
	}))

	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		if err := s.handleChannelFrame(data); err != nil {
			client.Send(mustJSON(ErrorMessage{
				Type:      MessageTypeError,
				Code:      "BAD_REQUEST",
				Message:   err.Error(),
				CreatedAt: nowRFC3339(),
			}))
		}
	}
}

func (s *Server) handleChannelMessage(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r, s.cfg.ChannelToken) {
		http.Error(w, "invalid channel token", http.StatusUnauthorized)
		return
	}
	if r.PathValue("channelID") != channelID {
		http.NotFound(w, r)
		return
	}

	var message ChannelMessage
	if err := json.NewDecoder(r.Body).Decode(&message); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}

	// HTTP 回调和 channel WebSocket 回包最终都会归一化成浏览器侧的 assistant.message。
	assistant, err := normalizeAssistantMessage(message)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	delivered := s.hub.BroadcastToBrowsers(assistant.ConversationID, assistant)
	writeJSON(w, http.StatusOK, DeliveryResponse{OK: true, Delivered: delivered})
}

func (s *Server) handleBrowserFrame(client *WSClient, conversationID string, data []byte) error {
	var message BrowserInboundMessage
	if err := json.Unmarshal(data, &message); err != nil {
		return fmt.Errorf("invalid json frame")
	}
	if message.Type != MessageTypeUserMessage {
		return fmt.Errorf("unsupported browser message type %q", message.Type)
	}
	if strings.TrimSpace(message.Text) == "" {
		return fmt.Errorf("message text is required")
	}
	message.ConversationID = conversationID
	if message.ID == "" {
		message.ID = fmt.Sprintf("browser-%d", time.Now().UnixNano())
	}
	if message.CreatedAt == "" {
		message.CreatedAt = nowRFC3339()
	}

	outbound := ChannelMessage{
		Type:           MessageTypeUserMessage,
		ID:             message.ID,
		ConversationID: message.ConversationID,
		Text:           message.Text,
		CreatedAt:      message.CreatedAt,
		Metadata:       message.Metadata,
	}
	delivered := s.hub.BroadcastToChannels(outbound)
	if delivered == 0 {
		// channel 插件侧未连接时，直接向浏览器回传聊天错误，避免用户发送后无限等待。
		client.Send(mustJSON(AssistantMessage{
			Type:           MessageTypeAssistant,
			MessageID:      fmt.Sprintf("error-%d", time.Now().UnixNano()),
			ConversationID: message.ConversationID,
			ReplyTo:        message.ID,
			Text:           "ClawBridge channel 未连接。",
			State:          StateError,
			CreatedAt:      nowRFC3339(),
		}))
	}
	return nil
}

func (s *Server) handleChannelFrame(data []byte) error {
	var message ChannelMessage
	if err := json.Unmarshal(data, &message); err != nil {
		return fmt.Errorf("invalid json frame")
	}
	if message.Type != MessageTypeAssistant {
		return fmt.Errorf("unsupported channel message type %q", message.Type)
	}

	assistant, err := normalizeAssistantMessage(message)
	if err != nil {
		return err
	}
	s.hub.BroadcastToBrowsers(assistant.ConversationID, assistant)
	return nil
}

func normalizeAssistantMessage(message ChannelMessage) (AssistantMessage, error) {
	if strings.TrimSpace(message.Text) == "" && message.State != StateError {
		return AssistantMessage{}, errors.New("message text is required")
	}

	conversationID := strings.TrimSpace(message.ConversationID)
	if conversationID == "" {
		conversationID = defaultConversationID
	}

	state := strings.TrimSpace(message.State)
	if state == "" {
		// 非流式简单回复允许真实通道插件省略 state。
		state = StateFinal
	}
	if state != StateDelta && state != StateFinal && state != StateError {
		return AssistantMessage{}, fmt.Errorf("unsupported message state %q", state)
	}

	messageID := strings.TrimSpace(message.MessageID)
	if messageID == "" {
		messageID = strings.TrimSpace(message.ID)
	}
	if messageID == "" {
		messageID = fmt.Sprintf("channel-%d", time.Now().UnixNano())
	}

	return AssistantMessage{
		Type:           MessageTypeAssistant,
		MessageID:      messageID,
		ConversationID: conversationID,
		ReplyTo:        strings.TrimSpace(message.ReplyTo),
		Text:           message.Text,
		State:          state,
		CreatedAt:      coalesce(message.CreatedAt, nowRFC3339()),
		Metadata:       message.Metadata,
	}, nil
}

func newConversationID() string {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err == nil {
		return conversationIDPrefix + hex.EncodeToString(bytes[:])
	}
	return fmt.Sprintf("%s%d", conversationIDPrefix, time.Now().UnixNano())
}

func (s *Server) acceptWebSocket(w http.ResponseWriter, r *http.Request) (*websocket.Conn, error) {
	opts := &websocket.AcceptOptions{
		OriginPatterns: s.cfg.AllowedOrigins,
	}
	if len(s.cfg.AllowedOrigins) == 1 && s.cfg.AllowedOrigins[0] == "*" {
		// 通配 Origin 仅用于本地冒烟测试或可信隧道；生产环境应配置明确来源。
		opts.InsecureSkipVerify = true
		opts.OriginPatterns = nil
	}
	return websocket.Accept(w, r, opts)
}

func (s *Server) authorized(r *http.Request, expectedToken string) bool {
	if expectedToken == "" {
		return true
	}
	return tokenFromRequest(r) == expectedToken
}

func (s *Server) validChannelID(value string) bool {
	return strings.TrimSpace(value) == channelID
}

func tokenFromRequest(r *http.Request) string {
	// 查询参数 token 用于浏览器和 channel WebSocket 连接；Authorization 用于 channel 侧服务间 HTTP 回调。
	if token := strings.TrimSpace(r.URL.Query().Get("token")); token != "" {
		return token
	}
	if token := strings.TrimSpace(r.Header.Get("X-ClawCore-Token")); token != "" {
		return token
	}
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	return ""
}

func (s *Server) withAccessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		s.logger.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func mustJSON(payload any) []byte {
	data, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}
	return data
}

func coalesce(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
