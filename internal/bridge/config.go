package bridge

import (
	"os"
	"strings"
)

// Config 保存 ClawCore 服务启动和鉴权所需的运行配置。
type Config struct {
	Addr           string
	BridgeToken    string
	OpenClawToken  string
	AllowedOrigins []string
}

// LoadConfigFromEnv 从环境变量读取部署配置，让同一个二进制可以运行在本地、隧道或公网反向代理后面。
func LoadConfigFromEnv() Config {
	cfg := Config{
		Addr:           envOrDefault("CLAWCORE_ADDR", ":8080"),
		BridgeToken:    strings.TrimSpace(os.Getenv("CLAWCORE_BRIDGE_TOKEN")),
		OpenClawToken:  strings.TrimSpace(os.Getenv("CLAWCORE_OPENCLAW_TOKEN")),
		AllowedOrigins: parseList(os.Getenv("CLAWCORE_ALLOWED_ORIGINS")),
	}
	if len(cfg.AllowedOrigins) == 0 {
		// 默认只允许本地浏览器来源；公网部署时应显式配置 ClawBridge 使用的 HTTPS 来源。
		cfg.AllowedOrigins = []string{
			"http://127.0.0.1:*",
			"http://localhost:*",
			"https://127.0.0.1:*",
			"https://localhost:*",
		}
	}
	return cfg
}

func envOrDefault(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func parseList(value string) []string {
	parts := strings.Split(value, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			items = append(items, item)
		}
	}
	return items
}
