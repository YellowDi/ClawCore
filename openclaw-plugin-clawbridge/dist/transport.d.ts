import type { ClawCoreAssistantMessage, ResolvedClawBridgeAccount } from "./types.js";
/** 创建连接 ClawCore/IM channel 入口的 WebSocket，鉴权参数放在查询串中。 */
export declare function createClawCoreWebSocket(account: ResolvedClawBridgeAccount): WebSocket;
/** 通过 HTTP 回调把 channel 回复投递给 ClawCore/IM。 */
export declare function sendClawCoreReply(params: {
    account: ResolvedClawBridgeAccount;
    message: ClawCoreAssistantMessage;
}): Promise<void>;
/** 兼容 Node WebSocket 可能返回的字符串、Buffer、ArrayBuffer 或 Blob。 */
export declare function decodeSocketData(data: unknown): Promise<string>;
/** 从 OpenClaw 回复 payload 中提取当前 ClawBridge channel 支持的文本内容。 */
export declare function extractReplyText(payload: {
    text?: string;
}): string;
/** 生成跨 chunk 稳定可追踪的消息 ID。 */
export declare function createMessageId(prefix?: string): string;
/** 等待一段可被 AbortSignal 中断的延迟，用于重连退避。 */
export declare function wait(ms: number, signal: AbortSignal): Promise<void>;
/** 等待 WebSocket 进入 open 状态，连接失败或提前关闭时返回错误。 */
export declare function waitForSocketOpen(socket: WebSocket, signal: AbortSignal): Promise<void>;
/** 等待 WebSocket 关闭；外部 abort 时主动关闭连接。 */
export declare function waitForSocketClose(socket: WebSocket, signal: AbortSignal): Promise<void>;
