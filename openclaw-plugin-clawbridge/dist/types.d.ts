import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
export type ClawBridgeAccountConfig = {
    name?: string;
    enabled?: boolean;
    serverUrl?: string;
    webSocketUrl?: string;
    botId?: string;
    botToken?: string;
    agentId?: string;
    defaultTo?: string;
    allowFrom?: string[];
    reconnectMs?: number;
};
export type ClawBridgeConfig = ClawBridgeAccountConfig & {
    accounts?: Record<string, ClawBridgeAccountConfig | undefined>;
    defaultAccount?: string;
};
export type ResolvedClawBridgeAccount = {
    accountId: string;
    name?: string;
    enabled: boolean;
    configured: boolean;
    serverUrl: string;
    webSocketUrl: string;
    botId: string;
    botToken: string;
    agentId?: string;
    defaultTo: string;
    allowFrom: string[];
    reconnectMs: number;
};
export type ClawBridgeCoreConfig = OpenClawConfig & {
    channels?: OpenClawConfig["channels"] & {
        clawbridge?: ClawBridgeConfig;
    };
};
export type ClawCoreUserMessage = {
    type: "user.message";
    id: string;
    conversationId?: string;
    text?: string;
    createdAt?: string;
    metadata?: Record<string, unknown>;
};
export type ClawCoreAssistantMessage = {
    conversationId: string;
    replyTo?: string;
    messageId: string;
    text: string;
    state: "delta" | "final" | "error";
};
