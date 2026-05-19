import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
/** 将 OpenClaw 出站文本回写到 ClawCore HTTP 回调接口。 */
export declare function sendClawBridgeText(params: {
    cfg: OpenClawConfig;
    accountId?: string | null;
    to: string;
    text: string;
    replyToId?: string | null;
}): Promise<{
    to: string;
    messageId: string;
}>;
/** 构造 OpenClaw durable message adapter 需要的标准回执。 */
export declare function createClawBridgeMessageReceipt(params: {
    messageId: string;
    conversationId: string;
    replyToId?: string | null;
}): import("openclaw/plugin-sdk/channel-message").MessageReceipt;
