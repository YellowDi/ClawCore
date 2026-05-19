import { buildChannelOutboundSessionRoute, createChatChannelPlugin, } from "openclaw/plugin-sdk/channel-core";
import { defineChannelMessageAdapter } from "openclaw/plugin-sdk/channel-message";
import { CHANNEL_ID, CHANNEL_LABEL } from "./constants.js";
import { clawBridgeConfigSchema, listClawBridgeAccountIds, resolveClawBridgeAccount, resolveDefaultClawBridgeAccountId, } from "./config.js";
import { startClawBridgeGatewayAccount } from "./gateway.js";
import { createClawBridgeMessageReceipt, sendClawBridgeText, } from "./outbound.js";
import { looksLikeClawBridgeTarget, normalizeClawBridgeTarget, } from "./target.js";
// message adapter 负责让 OpenClaw 共享 message 工具能把回复投递到 ClawCore。
const clawBridgeMessageAdapter = defineChannelMessageAdapter({
    id: CHANNEL_ID,
    durableFinal: {
        capabilities: {
            text: true,
            replyTo: true,
            messageSendingHooks: true,
        },
    },
    send: {
        text: async (ctx) => {
            const result = await sendClawBridgeText({
                cfg: ctx.cfg,
                accountId: ctx.accountId,
                to: ctx.to,
                text: ctx.text,
                replyToId: ctx.replyToId,
            });
            return {
                messageId: result.messageId,
                receipt: createClawBridgeMessageReceipt({
                    messageId: result.messageId,
                    conversationId: result.to,
                    replyToId: ctx.replyToId,
                }),
            };
        },
    },
});
/** OpenClaw 原生 channel 插件定义，注册配置、路由、网关和出站投递能力。 */
export const clawBridgePlugin = createChatChannelPlugin({
    base: {
        id: CHANNEL_ID,
        meta: {
            id: CHANNEL_ID,
            label: CHANNEL_LABEL,
            selectionLabel: CHANNEL_LABEL,
            detailLabel: "ClawCore Bridge",
            docsPath: "/channels/clawbridge",
            docsLabel: "clawbridge",
            blurb: "ClawCore WebSocket bridge for ClawPro custom channels.",
            markdownCapable: true,
            preferSessionLookupForAnnounceTarget: true,
            order: 90,
        },
        capabilities: {
            chatTypes: ["direct"],
            blockStreaming: true,
        },
        reload: { configPrefixes: ["channels.clawbridge"] },
        configSchema: clawBridgeConfigSchema,
        config: {
            listAccountIds: (cfg) => listClawBridgeAccountIds(cfg),
            resolveAccount: (cfg, accountId) => resolveClawBridgeAccount({
                cfg: cfg,
                accountId,
            }),
            defaultAccountId: (cfg) => resolveDefaultClawBridgeAccountId(cfg),
            isConfigured: (account) => account.configured,
            isEnabled: (account) => account.enabled,
            resolveAllowFrom: ({ cfg, accountId }) => resolveClawBridgeAccount({
                cfg: cfg,
                accountId,
            }).allowFrom,
            resolveDefaultTo: ({ cfg, accountId }) => resolveClawBridgeAccount({
                cfg: cfg,
                accountId,
            }).defaultTo,
            describeAccount: (account) => ({
                accountId: account.accountId,
                name: account.name,
                enabled: account.enabled,
                configured: account.configured,
                baseUrl: account.serverUrl,
            }),
        },
        status: {
            defaultRuntime: {
                accountId: "default",
                running: false,
                connected: false,
            },
            buildChannelSummary: ({ snapshot }) => ({
                ok: snapshot.configured === true,
                label: snapshot.configured ? "configured" : "missing config",
                detail: snapshot.baseUrl ?? "",
            }),
            buildAccountSnapshot: ({ account, runtime }) => ({
                ...runtime,
                accountId: account.accountId,
                name: account.name,
                enabled: account.enabled,
                configured: account.configured,
                baseUrl: account.serverUrl,
            }),
        },
        messaging: {
            targetPrefixes: ["clawbridge", "clawcore"],
            normalizeTarget: normalizeClawBridgeTarget,
            parseExplicitTarget: ({ raw }) => ({
                to: normalizeClawBridgeTarget(raw),
                chatType: "direct",
            }),
            inferTargetChatType: () => "direct",
            targetResolver: {
                looksLikeId: looksLikeClawBridgeTarget,
                hint: "<conversation_id>",
            },
            resolveOutboundSessionRoute: ({ cfg, agentId, accountId, target }) => {
                const conversationId = normalizeClawBridgeTarget(target);
                return buildChannelOutboundSessionRoute({
                    cfg,
                    agentId,
                    channel: CHANNEL_ID,
                    accountId,
                    peer: {
                        kind: "direct",
                        id: conversationId,
                    },
                    chatType: "direct",
                    from: `${CHANNEL_ID}:${accountId ?? "default"}`,
                    to: conversationId,
                });
            },
            resolveSessionConversation: ({ rawId }) => {
                const conversationId = normalizeClawBridgeTarget(rawId);
                return {
                    id: conversationId,
                    baseConversationId: conversationId,
                    parentConversationCandidates: [conversationId],
                };
            },
        },
        gateway: {
            startAccount: startClawBridgeGatewayAccount,
        },
        message: clawBridgeMessageAdapter,
    },
    outbound: {
        base: { deliveryMode: "direct" },
        attachedResults: {
            channel: CHANNEL_ID,
            sendText: async ({ cfg, accountId, to, text, replyToId }) => await sendClawBridgeText({
                cfg,
                accountId,
                to,
                text,
                replyToId,
            }),
        },
    },
});
//# sourceMappingURL=channel.js.map