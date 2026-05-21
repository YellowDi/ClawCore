import type { ChannelConfigSchema } from "openclaw/plugin-sdk";

import {
  DEFAULT_ACCOUNT_ID,
  DEFAULT_CONVERSATION_ID,
  DEFAULT_RECONNECT_MS,
} from "./constants.js";
import type {
  ClawBridgeAccountConfig,
  ClawBridgeConfig,
  ClawBridgeCoreConfig,
  ResolvedClawBridgeAccount,
} from "./types.js";

const channelAccountProperties = {
  name: { type: "string" },
  enabled: { type: "boolean" },
  serverUrl: { type: "string", format: "uri" },
  wsUrl: { type: "string", format: "uri" },
  token: { type: "string" },
  agentId: { type: "string" },
  defaultTo: { type: "string" },
  allowFrom: { type: "array", items: { type: "string" } },
  reconnectMs: { type: "integer", minimum: 100, maximum: 60000 },
} as const;

export const clawBridgeConfigSchema: ChannelConfigSchema = {
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
      label: "IM Server URL",
      placeholder: "https://example.com",
    },
    wsUrl: {
      label: "IM WebSocket URL",
      placeholder: "wss://example.com/ws/channel",
    },
    token: {
      label: "User token",
      sensitive: true,
    },
  },
};

/** 列出已配置的 ClawBridge 账号；未配置 named accounts 时回退到 default。 */
export function listClawBridgeAccountIds(cfg: ClawBridgeCoreConfig): string[] {
  const accountIds = Object.keys(cfg.channels?.clawbridge?.accounts ?? {}).filter(Boolean);
  return accountIds.length > 0 ? accountIds : [DEFAULT_ACCOUNT_ID];
}

/** 解析默认账号 ID，供 OpenClaw 启动 channel runtime 时选择账号。 */
export function resolveDefaultClawBridgeAccountId(cfg: ClawBridgeCoreConfig): string {
  return normalizeAccountId(cfg.channels?.clawbridge?.defaultAccount);
}

/** 合并顶层配置和账号配置，并归一化为运行时可直接使用的账号对象。 */
export function resolveClawBridgeAccount(params: {
  cfg: ClawBridgeCoreConfig;
  accountId?: string | null;
}): ResolvedClawBridgeAccount {
  const accountId = normalizeAccountId(params.accountId);
  const channel = params.cfg.channels?.clawbridge ?? {};
  const accountConfig = channel.accounts?.[accountId] ?? {};
  const merged = mergeAccountConfig(channel, accountConfig);
  const serverUrl = normalizeServerUrl(merged.serverUrl);
  const wsUrl = normalizeWsUrl(merged.wsUrl, serverUrl);
  const token = merged.token?.trim() ?? "";

  return {
    accountId,
    name: merged.name?.trim() || undefined,
    enabled: channel.enabled !== false && merged.enabled !== false,
    configured: Boolean(serverUrl && wsUrl && token),
    serverUrl,
    wsUrl,
    token,
    agentId: merged.agentId?.trim() || undefined,
    defaultTo: merged.defaultTo?.trim() || DEFAULT_CONVERSATION_ID,
    allowFrom: normalizeAllowFrom(merged.allowFrom),
    reconnectMs: merged.reconnectMs ?? DEFAULT_RECONNECT_MS,
  };
}

function mergeAccountConfig(
  channel: ClawBridgeConfig,
  account: ClawBridgeAccountConfig,
): ClawBridgeAccountConfig {
  return {
    name: account.name ?? channel.name,
    enabled: account.enabled ?? channel.enabled,
    serverUrl: account.serverUrl ?? channel.serverUrl,
    wsUrl: account.wsUrl ?? channel.wsUrl,
    token: account.token ?? channel.token,
    agentId: account.agentId ?? channel.agentId,
    defaultTo: account.defaultTo ?? channel.defaultTo,
    allowFrom: account.allowFrom ?? channel.allowFrom,
    reconnectMs: account.reconnectMs ?? channel.reconnectMs,
  };
}

function normalizeAccountId(value?: string | null): string {
  return value?.trim() || DEFAULT_ACCOUNT_ID;
}

function normalizeAllowFrom(value?: string[]): string[] {
  const allowFrom = (value ?? ["*"]).map((entry) => entry.trim()).filter(Boolean);
  return allowFrom.length > 0 ? allowFrom : ["*"];
}

function normalizeServerUrl(value?: string): string {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

function normalizeWsUrl(value: string | undefined, serverUrl: string): string {
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
  url.pathname = "/ws/channel";
  url.search = "";
  url.hash = "";
  return url.toString();
}
