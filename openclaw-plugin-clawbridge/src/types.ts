import type { OpenClawConfig } from "openclaw/plugin-sdk/channel-core";

export type ClawBridgeAccountConfig = {
  name?: string;
  enabled?: boolean;
  serverUrl?: string;
  wsUrl?: string;
  token?: string;
  accessKey?: string;
  secretKey?: string;
  agentId?: string;
  defaultTo?: string;
  allowFrom?: string[];
  reconnectMs?: number;
  [key: string]: unknown;
};

export type ClawBridgeConfig = {
  name?: string;
  enabled?: boolean;
  accounts?: Record<string, ClawBridgeAccountConfig | undefined>;
  defaultAccount?: string;
  [key: string]: unknown;
};

export type ResolvedClawBridgeAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  serverUrl: string;
  wsUrl: string;
  token: string;
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
  createdAt?: string;
  metadata?: Record<string, unknown>;
};
