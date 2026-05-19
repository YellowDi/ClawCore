package bridge

import (
	"context"
	"sync"
	"time"

	"github.com/coder/websocket"
)

const writeTimeout = 5 * time.Second

// WSClient 表示一个带发送队列的 WebSocket 客户端连接。
type WSClient struct {
	conn *websocket.Conn
	send chan []byte
	once sync.Once
}

// NewWSClient 使用有界发送队列包装 WebSocket。队列满时丢弃该次发送，避免单个慢客户端拖住整个桥接服务。
func NewWSClient(conn *websocket.Conn) *WSClient {
	return &WSClient{
		conn: conn,
		send: make(chan []byte, 32),
	}
}

// Send 将消息放入客户端发送队列，队列已满时返回 false。
func (c *WSClient) Send(data []byte) bool {
	select {
	case c.send <- data:
		return true
	default:
		return false
	}
}

// Close 关闭客户端连接，并保证关闭动作只执行一次。
func (c *WSClient) Close(status websocket.StatusCode, reason string) {
	c.once.Do(func() {
		close(c.send)
		_ = c.conn.Close(status, reason)
	})
}

// WriteLoop 是每个 WebSocket 连接唯一的写循环。统一串行写入可以让关闭和错误处理更可预测。
func (c *WSClient) WriteLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case data, ok := <-c.send:
			if !ok {
				return
			}

			writeCtx, cancel := context.WithTimeout(context.Background(), writeTimeout)
			err := c.conn.Write(writeCtx, websocket.MessageText, data)
			cancel()
			if err != nil {
				c.Close(websocket.StatusInternalError, "write failed")
				return
			}
		}
	}
}
