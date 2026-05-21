import { resolveClawBridgeAccount } from "./config.js";
import { createMessageId, sendClawCoreReply } from "./transport.js";
import { normalizeClawBridgeTarget } from "./target.js";
/** 将 OpenClaw channel 出站文本回写到 ClawCore/IM HTTP 回调接口。 */
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
            createdAt: new Date().toISOString(),
            metadata: {
                channelId: "clawbridge",
                accountId: account.accountId,
            },
        },
    });
    return { to: conversationId, messageId };
}
//# sourceMappingURL=outbound.js.map