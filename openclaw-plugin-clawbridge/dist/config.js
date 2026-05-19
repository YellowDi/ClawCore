import { DEFAULT_ACCOUNT_ID, DEFAULT_CONVERSATION_ID, DEFAULT_RECONNECT_MS, } from "./constants.js";
const channelAccountProperties = {
    name: { type: "string" },
    enabled: { type: "boolean" },
    serverUrl: { type: "string", format: "uri" },
    webSocketUrl: { type: "string", format: "uri" },
    botId: { type: "string" },
    botToken: { type: "string" },
    agentId: { type: "string" },
    defaultTo: { type: "string" },
    allowFrom: { type: "array", items: { type: "string" } },
    reconnectMs: { type: "integer", minimum: 100, maximum: 60000 },
};
export const clawBridgeConfigSchema = {
    schema: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
            ...channelAccountProperties,
            accounts: {
                type: "object",
                propertyNames: { type: "string" },
                additionalProperties: {
                    type: "object",
                    additionalProperties: false,
                    properties: channelAccountProperties,
                },
            },
            defaultAccount: { type: "string" },
        },
    },
    uiHints: {
        serverUrl: {
            label: "ClawCore Server URL",
            placeholder: "https://example.com",
        },
        webSocketUrl: {
            label: "ClawCore WebSocket URL",
            placeholder: "wss://example.com/ws/openclaw",
        },
        botToken: {
            label: "Bot token",
            sensitive: true,
        },
    },
};
/** 列出已配置的 ClawBridge 账号；未配置 named accounts 时回退到 default。 */
export function listClawBridgeAccountIds(cfg) {
    const accountIds = Object.keys(cfg.channels?.clawbridge?.accounts ?? {}).filter(Boolean);
    return accountIds.length > 0 ? accountIds : [DEFAULT_ACCOUNT_ID];
}
/** 解析默认账号 ID，供 OpenClaw 启动 channel runtime 时选择账号。 */
export function resolveDefaultClawBridgeAccountId(cfg) {
    return normalizeAccountId(cfg.channels?.clawbridge?.defaultAccount);
}
/** 合并顶层配置和账号配置，并归一化为运行时可直接使用的账号对象。 */
export function resolveClawBridgeAccount(params) {
    const accountId = normalizeAccountId(params.accountId);
    const channel = params.cfg.channels?.clawbridge ?? {};
    const accountConfig = channel.accounts?.[accountId] ?? {};
    const merged = mergeAccountConfig(channel, accountConfig);
    const serverUrl = normalizeServerUrl(merged.serverUrl);
    const webSocketUrl = normalizeWebSocketUrl(merged.webSocketUrl, serverUrl);
    const botToken = merged.botToken?.trim() ?? "";
    const botId = merged.botId?.trim() || "clawbridge";
    return {
        accountId,
        name: merged.name?.trim() || undefined,
        enabled: channel.enabled !== false && merged.enabled !== false,
        configured: Boolean(serverUrl && webSocketUrl && botToken),
        serverUrl,
        webSocketUrl,
        botId,
        botToken,
        agentId: merged.agentId?.trim() || undefined,
        defaultTo: merged.defaultTo?.trim() || DEFAULT_CONVERSATION_ID,
        allowFrom: normalizeAllowFrom(merged.allowFrom),
        reconnectMs: merged.reconnectMs ?? DEFAULT_RECONNECT_MS,
    };
}
function mergeAccountConfig(channel, account) {
    return {
        name: account.name ?? channel.name,
        enabled: account.enabled ?? channel.enabled,
        serverUrl: account.serverUrl ?? channel.serverUrl,
        webSocketUrl: account.webSocketUrl ?? channel.webSocketUrl,
        botId: account.botId ?? channel.botId,
        botToken: account.botToken ?? channel.botToken,
        agentId: account.agentId ?? channel.agentId,
        defaultTo: account.defaultTo ?? channel.defaultTo,
        allowFrom: account.allowFrom ?? channel.allowFrom,
        reconnectMs: account.reconnectMs ?? channel.reconnectMs,
    };
}
function normalizeAccountId(value) {
    return value?.trim() || DEFAULT_ACCOUNT_ID;
}
function normalizeAllowFrom(value) {
    const allowFrom = (value ?? ["*"]).map((entry) => entry.trim()).filter(Boolean);
    return allowFrom.length > 0 ? allowFrom : ["*"];
}
function normalizeServerUrl(value) {
    return value?.trim().replace(/\/+$/, "") ?? "";
}
function normalizeWebSocketUrl(value, serverUrl) {
    const explicit = value?.trim();
    if (explicit) {
        return explicit;
    }
    if (!serverUrl) {
        return "";
    }
    // 缺省 WebSocket 地址由 Server URL 推导，方便 ClawPro 只维护一个公网域名。
    const url = new URL(serverUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws/openclaw";
    url.search = "";
    url.hash = "";
    return url.toString();
}
//# sourceMappingURL=config.js.map