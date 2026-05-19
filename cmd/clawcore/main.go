package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"clawcore/internal/bridge"
)

func main() {
	logger := log.New(os.Stdout, "clawcore ", log.LstdFlags|log.Lmsgprefix)
	cfg := bridge.LoadConfigFromEnv()
	server := bridge.NewServer(cfg, logger)

	httpServer := &http.Server{
		Addr:              cfg.Addr,
		Handler:           server.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		logger.Printf("listening on %s", cfg.Addr)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Fatalf("server failed: %v", err)
		}
	}()

	<-ctx.Done()
	// 收到 Ctrl-C 或 SIGTERM 后，给活跃 WebSocket handler 一个短暂窗口完成正常关闭。
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		logger.Printf("shutdown failed: %v", err)
	}
}
