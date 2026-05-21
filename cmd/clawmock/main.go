package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/coder/websocket"
)

type message struct {
	Type           string `json:"type"`
	ID             string `json:"id,omitempty"`
	ConversationID string `json:"conversationId,omitempty"`
	Text           string `json:"text,omitempty"`
	ReplyTo        string `json:"replyTo,omitempty"`
	MessageID      string `json:"messageId,omitempty"`
	State          string `json:"state,omitempty"`
}

func main() {
	wsURL := flag.String("ws", envOrDefault("CLAWCORE_CHANNEL_WS_URL", "ws://127.0.0.1:8080/ws/channel"), "ClawCore channel WebSocket URL")
	httpURL := flag.String("http", envOrDefault("CLAWCORE_HTTP_URL", "http://127.0.0.1:8080"), "ClawCore HTTP base URL")
	token := flag.String("token", os.Getenv("CLAWCORE_CHANNEL_TOKEN"), "channel token")
	accountID := flag.String("account", envOrDefault("CLAWCORE_CHANNEL_ACCOUNT_ID", "default"), "channel account ID")
	flag.Parse()

	endpoint, err := withChannelQuery(*wsURL, *accountID, *token)
	if err != nil {
		log.Fatalf("invalid ws url: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	conn, _, err := websocket.Dial(ctx, endpoint, nil)
	if err != nil {
		log.Fatalf("connect failed: %v", err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "mock stopped")

	log.Printf("mock channel connected to %s", endpoint)
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			log.Fatalf("read failed: %v", err)
		}

		var incoming message
		if err := json.Unmarshal(data, &incoming); err != nil {
			log.Printf("invalid json: %s", string(data))
			continue
		}
		if incoming.Type != "user.message" {
			continue
		}

		// 模拟客户端刻意使用与真实 channel 插件一致的 HTTP 回调接口返回消息。
		reply := message{
			ConversationID: incoming.ConversationID,
			ReplyTo:        incoming.ID,
			MessageID:      fmt.Sprintf("mock-%d", time.Now().UnixNano()),
			Text:           "模拟 channel 回复：" + incoming.Text,
			State:          "final",
		}
		if err := postReply(ctx, *httpURL, *token, reply); err != nil {
			log.Printf("reply failed: %v", err)
			continue
		}
		log.Printf("replied to %s", incoming.ID)
	}
}

func postReply(ctx context.Context, baseURL, token string, payload message) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	endpoint := strings.TrimRight(baseURL, "/") + "/api/channels/clawbridge/messages"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected status %s", resp.Status)
	}
	return nil
}

func withChannelQuery(rawURL, accountID, token string) (string, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("channel_id", "clawbridge")
	if strings.TrimSpace(accountID) != "" {
		q.Set("account_id", strings.TrimSpace(accountID))
	}
	if token != "" {
		q.Set("token", token)
	}
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func envOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}
