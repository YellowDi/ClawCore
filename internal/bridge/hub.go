package bridge

import (
	"encoding/json"
	"sync"
)

// Hub 维护当前在线的浏览器连接和 OpenClaw 侧连接，并负责消息广播。
type Hub struct {
	mu        sync.RWMutex
	browsers  map[string]map[*WSClient]struct{}
	openclaws map[*WSClient]struct{}
}

// NewHub 创建内存连接中心。它不保存持久状态，客户端重连后重新建立会话视图。
func NewHub() *Hub {
	return &Hub{
		browsers:  make(map[string]map[*WSClient]struct{}),
		openclaws: make(map[*WSClient]struct{}),
	}
}

// AddBrowser 将浏览器连接加入指定会话。
func (h *Hub) AddBrowser(conversationID string, client *WSClient) {
	h.mu.Lock()
	defer h.mu.Unlock()

	clients := h.browsers[conversationID]
	if clients == nil {
		clients = make(map[*WSClient]struct{})
		h.browsers[conversationID] = clients
	}
	clients[client] = struct{}{}
}

// RemoveBrowser 从指定会话移除浏览器连接。
func (h *Hub) RemoveBrowser(conversationID string, client *WSClient) {
	h.mu.Lock()
	defer h.mu.Unlock()

	clients := h.browsers[conversationID]
	if clients == nil {
		return
	}
	delete(clients, client)
	if len(clients) == 0 {
		delete(h.browsers, conversationID)
	}
}

// AddOpenClaw 注册一个 OpenClaw 侧连接。
func (h *Hub) AddOpenClaw(client *WSClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.openclaws[client] = struct{}{}
}

// RemoveOpenClaw 移除一个 OpenClaw 侧连接。
func (h *Hub) RemoveOpenClaw(client *WSClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.openclaws, client)
}

// BroadcastToBrowsers 向指定会话下的所有浏览器连接广播消息。
func (h *Hub) BroadcastToBrowsers(conversationID string, payload any) int {
	data, err := json.Marshal(payload)
	if err != nil {
		return 0
	}

	h.mu.RLock()
	// 在读锁内复制连接快照，随后释放锁再发送，避免慢连接阻塞注册或清理。
	clients := cloneClients(h.browsers[conversationID])
	h.mu.RUnlock()

	delivered := 0
	for _, client := range clients {
		if client.Send(data) {
			delivered++
		}
	}
	return delivered
}

// BroadcastToOpenClaws 向所有 OpenClaw 侧连接广播消息。
func (h *Hub) BroadcastToOpenClaws(payload any) int {
	data, err := json.Marshal(payload)
	if err != nil {
		return 0
	}

	h.mu.RLock()
	// 当前所有 OpenClaw 连接共用一个广播组；真实插件后续可按机器人或账号元数据路由。
	clients := cloneClients(h.openclaws)
	h.mu.RUnlock()

	delivered := 0
	for _, client := range clients {
		if client.Send(data) {
			delivered++
		}
	}
	return delivered
}

func cloneClients(source map[*WSClient]struct{}) []*WSClient {
	clients := make([]*WSClient, 0, len(source))
	for client := range source {
		clients = append(clients, client)
	}
	return clients
}
