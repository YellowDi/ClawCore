package bridge

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

func TestHealthz(t *testing.T) {
	server := NewServer(Config{AllowedOrigins: []string{"*"}}, nil)
	ts := httptest.NewServer(server.Handler())
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestOpenClawHTTPRequiresToken(t *testing.T) {
	server := NewServer(Config{OpenClawToken: "secret", AllowedOrigins: []string{"*"}}, nil)
	ts := httptest.NewServer(server.Handler())
	defer ts.Close()

	resp, err := http.Post(ts.URL+"/api/openclaw/messages", "application/json", strings.NewReader(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestOpenClawHTTPBroadcastsToBrowser(t *testing.T) {
	server := NewServer(Config{
		BridgeToken:    "bridge",
		OpenClawToken:  "openclaw",
		AllowedOrigins: []string{"*"},
	}, nil)
	ts := httptest.NewServer(server.Handler())
	defer ts.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws/browser?conversation_id=main&token=bridge"
	conn, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "test done")

	_, _, err = conn.Read(ctx) // 读取 connection.ready
	if err != nil {
		t.Fatal(err)
	}

	payload := OpenClawMessage{
		ConversationID: "main",
		ReplyTo:        "user-1",
		MessageID:      "assistant-1",
		Text:           "hello from openclaw",
		State:          StateFinal,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, ts.URL+"/api/openclaw/messages", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer openclaw")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	_, data, err := conn.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}

	var message AssistantMessage
	if err := json.Unmarshal(data, &message); err != nil {
		t.Fatal(err)
	}
	if message.Type != MessageTypeAssistant || message.Text != "hello from openclaw" {
		t.Fatalf("unexpected browser message: %#v", message)
	}
}

func TestBrowserMessageRoutesToOpenClaw(t *testing.T) {
	server := NewServer(Config{
		BridgeToken:    "bridge",
		OpenClawToken:  "openclaw",
		AllowedOrigins: []string{"*"},
	}, nil)
	ts := httptest.NewServer(server.Handler())
	defer ts.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	openClawWS := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws/openclaw?token=openclaw"
	openClawConn, _, err := websocket.Dial(ctx, openClawWS, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer openClawConn.Close(websocket.StatusNormalClosure, "test done")
	_, _, err = openClawConn.Read(ctx) // 读取 connection.ready
	if err != nil {
		t.Fatal(err)
	}

	browserWS := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws/browser?conversation_id=main&token=bridge"
	browserConn, _, err := websocket.Dial(ctx, browserWS, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer browserConn.Close(websocket.StatusNormalClosure, "test done")
	_, _, err = browserConn.Read(ctx) // 读取 connection.ready
	if err != nil {
		t.Fatal(err)
	}

	outbound := BrowserInboundMessage{
		Type:           MessageTypeUserMessage,
		ID:             "user-1",
		ConversationID: "main",
		Text:           "ping",
	}
	body, err := json.Marshal(outbound)
	if err != nil {
		t.Fatal(err)
	}
	if err := browserConn.Write(ctx, websocket.MessageText, body); err != nil {
		t.Fatal(err)
	}

	_, data, err := openClawConn.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}

	var routed OpenClawMessage
	if err := json.Unmarshal(data, &routed); err != nil {
		t.Fatal(err)
	}
	if routed.Type != MessageTypeUserMessage || routed.Text != "ping" || routed.ID != "user-1" {
		t.Fatalf("unexpected routed message: %#v", routed)
	}
}
