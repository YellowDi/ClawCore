import { createMessageReceiptFromOutboundResults } from "openclaw/plugin-sdk/channel-message";
import { CHANNEL_ID } from "./constants.js";
import { resolveClawBridgeAccount } from "./config.js";
import { createMessageId, sendClawCoreReply } from "./transport.js";
import { normalizeClawBridgeTarget } from "./target.js";
/** 将 OpenClaw 出站文本回写到 ClawCore HTTP 回调接口。 */
export async function sendClawBridgeText(params) {
    const account = resolveClawBridgeAccount({
        cfg: params.cfg,
        accountId: params.accountId,
    });
    if (!account.configured) {
        throw new Error(`ClawBridge account "${account.accountId}" is not configured`);
    }
    const conversationId = normalizeClawBridgeTarget(params.to);
    const messageId = createMessageId("clawbridge-out");
    await sendClawCoreReply({
        account,
        message: {
            conversationId,
            replyTo: params.replyToId ?? undefined,
            messageId,
            text: params.text,
            state: "final",
        },
    });
    return { to: conversationId, messageId };
}
/** 构造 OpenClaw durable message adapter 需要的标准回执。 */
export function createClawBridgeMessageReceipt(params) {
    return createMessageReceiptFromOutboundResults({
        results: [
            {
                channel: CHANNEL_ID,
                messageId: params.messageId,
                conversationId: params.conversationId,
            },
        ],
        kind: "text",
        replyToId: params.replyToId ?? undefined,
    });
}
//# sourceMappingURL=outbound.js.map