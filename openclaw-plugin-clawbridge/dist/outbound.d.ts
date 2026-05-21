import type { OpenClawConfig } from "openclaw/plugin-sdk/channel-core";
/** 将 OpenClaw channel 出站文本回写到 ClawCore/IM HTTP 回调接口。 */
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
