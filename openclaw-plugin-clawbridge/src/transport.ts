import { Buffer } from "node:buffer";

import { CHANNEL_ID, CLAWCORE_ASSISTANT_MESSAGE_TYPE } from "./constants.js";
import type { ClawCoreAssistantMessage, ResolvedClawBridgeAccount } from "./types.js";

/** 创建连接 ClawCore/IM channel 入口的 WebSocket，鉴权参数放在查询串中。 */
export function createClawCoreWebSocket(account: ResolvedClawBridgeAccount): WebSocket {
  const url = new URL(account.wsUrl);
  url.searchParams.set("channel_id", CHANNEL_ID);
  url.searchParams.set("account_id", account.accountId);
  url.searchParams.set("token", account.token);
  return new WebSocket(url);
}

/** 通过 HTTP 回调把 channel 回复投递给 ClawCore/IM。 */
export async function sendClawCoreReply(params: {
  account: ResolvedClawBridgeAccount;
  message: ClawCoreAssistantMessage;
}): Promise<void> {
  const response = await fetch(`${params.account.serverUrl}/api/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.account.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      type: CLAWCORE_ASSISTANT_MESSAGE_TYPE,
      conversationId: params.message.conversationId,
      replyTo: params.message.replyTo,
      messageId: params.message.messageId,
      text: params.message.text,
      state: params.message.state,
      createdAt: params.message.createdAt,
      metadata: params.message.metadata,
    }),
  });

  if (!response.ok) {
    throw new Error(`ClawCore reply failed: ${response.status} ${await response.text()}`);
  }
}

/** 兼容 Node WebSocket 可能返回的字符串、Buffer、ArrayBuffer 或 Blob。 */
export async function decodeSocketData(data: unknown): Promise<string> {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  }
  if (data instanceof Blob) {
    return await data.text();
  }
  return String(data ?? "");
}

/** 从 OpenClaw 回复 payload 中提取当前 ClawBridge channel 支持的文本内容。 */
export function extractReplyText(payload: { text?: string }): string {
  return typeof payload.text === "string" ? payload.text : "";
}

/** 生成跨 chunk 稳定可追踪的消息 ID。 */
export function createMessageId(prefix = "clawbridge"): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** 等待一段可被 AbortSignal 中断的延迟，用于重连退避。 */
export function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => done();
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** 等待 WebSocket 进入 open 状态，连接失败或提前关闭时返回错误。 */
export function waitForSocketOpen(socket: WebSocket, signal: AbortSignal): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal.removeEventListener("abort", abort);
      socket.removeEventListener("open", open);
      socket.removeEventListener("error", error);
      socket.removeEventListener("close", close);
    };
    const open = () => {
      cleanup();
      resolve();
    };
    const error = () => {
      cleanup();
      reject(new Error("ClawCore WebSocket open failed"));
    };
    const close = () => {
      cleanup();
      reject(new Error("ClawCore WebSocket closed before opening"));
    };
    const abort = () => {
      cleanup();
      socket.close();
      resolve();
    };

    signal.addEventListener("abort", abort, { once: true });
    socket.addEventListener("open", open, { once: true });
    socket.addEventListener("error", error, { once: true });
    socket.addEventListener("close", close, { once: true });
  });
}

/** 等待 WebSocket 关闭；外部 abort 时主动关闭连接。 */
export function waitForSocketClose(socket: WebSocket, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const cleanup = () => {
      signal.removeEventListener("abort", abort);
      socket.removeEventListener("close", close);
      socket.removeEventListener("error", close);
    };
    const close = () => {
      cleanup();
      resolve();
    };
    const abort = () => {
      cleanup();
      socket.close();
      resolve();
    };

    signal.addEventListener("abort", abort, { once: true });
    socket.addEventListener("close", close, { once: true });
    socket.addEventListener("error", close, { once: true });
  });
}
