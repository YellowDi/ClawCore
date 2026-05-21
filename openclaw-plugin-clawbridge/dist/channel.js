import { buildChannelOutboundSessionRoute, createChatChannelPlugin, } from "openclaw/plugin-sdk/channel-core";
import { jsonResult, readStringParam } from "openclaw/plugin-sdk/channel-actions";
import { CHANNEL_ID, CHANNEL_LABEL } from "./constants.js";
import { clawBridgeConfigSchema, listClawBridgeAccountIds, resolveClawBridgeAccount, resolveDefaultClawBridgeAccountId, } from "./config.js";
import { startClawBridgeGatewayAccount } from "./gateway.js";
import { sendClawBridgeText } from "./outbound.js";
import { looksLikeClawBridgeTarget, normalizeClawBridgeTarget, } from "./target.js";
/** OpenClaw 原生 channel 插件定义，注册配置、路由、网关和出站投递能力。 */
export const clawBridgePlugin = createChatChannelPlugin({
    base: {
        id: CHANNEL_ID,
        meta: {
            id: CHANNEL_ID,
            label: CHANNEL_LABEL,
            selectionLabel: CHANNEL_LABEL,
            detailLabel: "ClawPro IM Channel",
            docsPath: "/channels/clawbridge",
            docsLabel: "clawbridge",
            blurb: "ClawPro IM channel over ClawCore serverUrl/wsUrl.",
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
        actions: {
            describeMessageTool: ({ cfg, accountId }) => {
                const account = resolveClawBridgeAccount({
                    cfg: cfg,
                    accountId,
                });
                return account.configured && account.enabled
                    ? {
                        actions: ["send"],
                    }
                    : null;
            },
            extractToolSend: ({ args }) => {
                const action = typeof args.action === "string" ? args.action.trim() : "";
                if (action !== "send" && action !== "sendMessage") {
                    return null;
                }
                const to = typeof args.to === "string" ? args.to.trim() : "";
                if (!to) {
                    return null;
                }
                const accountId = typeof args.accountId === "string" ? args.accountId.trim() : undefined;
                const threadId = typeof args.threadId === "string" ? args.threadId.trim() : undefined;
                return {
                    to: normalizeClawBridgeTarget(to),
                    accountId,
                    threadId,
                };
            },
            handleAction: async ({ action, params, cfg, accountId }) => {
                if (action !== "send") {
                    throw new Error(`ClawBridge does not support message action "${action}"`);
                }
                const to = readStringParam(params, "to", { required: true });
                const text = readStringParam(params, "message", { required: true, allowEmpty: false });
                const replyToId = readStringParam(params, "replyTo", { allowEmpty: false });
                const result = await sendClawBridgeText({
                    cfg,
                    accountId,
                    to,
                    text,
                    replyToId,
                });
                return jsonResult({
                    ok: true,
                    to: result.to,
                    messageId: result.messageId,
                });
            },
        },
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