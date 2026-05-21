import { dispatchInboundDirectDmWithRuntime } from "openclaw/plugin-sdk/direct-dm";
import type { OpenClawConfig, PluginRuntime } from "openclaw/plugin-sdk/channel-core";

import { CHANNEL_ID, CHANNEL_LABEL } from "./constants.js";
import { createMessageId, extractReplyText, sendClawCoreReply } from "./transport.js";
import type { ClawCoreUserMessage, ResolvedClawBridgeAccount } from "./types.js";

type ChannelRuntime = PluginRuntime["channel"];

/** 把 ClawCore/IM 用户消息转换成 OpenClaw channel 入站上下文，并执行一次 agent turn。 */
export async function handleClawCoreUserMessage(params: {
  cfg: OpenClawConfig;
  runtime: ChannelRuntime;
  account: ResolvedClawBridgeAccount;
  message: ClawCoreUserMessage;
}): Promise<void> {
  const text = params.message.text?.trim() ?? "";
  if (!text) {
    return;
  }

  const conversationId = params.message.conversationId?.trim() || params.account.defaultTo;
  const senderName = readStringMetadata(params.message.metadata, "senderName") ?? "ClawBridge User";
  const assistantMessageId = createMessageId("clawbridge-in");

  await dispatchInboundDirectDmWithRuntime({
    cfg: params.cfg,
    runtime: createDirectDmRuntime({
      runtime: params.runtime,
      cfg: params.cfg,
      account: params.account,
      conversationId,
    }),
    channel: CHANNEL_ID,
    accountId: params.account.accountId,
    channelLabel: CHANNEL_LABEL,
    peer: {
      kind: "direct",
      id: conversationId,
    },
    senderId: readStringMetadata(params.message.metadata, "senderId") ?? "clawbridge-user",
    senderAddress: conversationId,
    recipientAddress: conversationId,
    conversationLabel: senderName,
    rawBody: text,
    bodyForAgent: text,
    commandBody: text,
    messageId: params.message.id,
    timestamp: parseTimestampMs(params.message.createdAt),
    commandAuthorized: true,
    // OpenClaw 2026.4.23 的入站上下文仍保留 legacy Provider 字段；这里始终填 channel id。
    provider: CHANNEL_ID,
    surface: CHANNEL_ID,
    originatingChannel: CHANNEL_ID,
    originatingTo: conversationId,
    extraContext: {
      SenderName: senderName,
      ReplyToId: params.message.id,
      ReplyToIdFull: params.message.id,
    },
    deliver: async (payload) => {
      const replyText = extractReplyText(payload);
      if (!replyText.trim()) {
        return;
      }
      await sendClawCoreReply({
        account: params.account,
        message: {
          conversationId,
          replyTo: params.message.id,
          messageId: assistantMessageId,
          text: replyText,
          state: "final",
          createdAt: new Date().toISOString(),
          metadata: {
            channelId: CHANNEL_ID,
            accountId: params.account.accountId,
          },
        },
      });
    },
    onRecordError: (error) => {
      throw error instanceof Error
        ? error
        : new Error(`ClawBridge session record failed: ${String(error)}`);
    },
    onDispatchError: (error) => {
      throw error instanceof Error
        ? error
        : new Error(`ClawBridge dispatch failed: ${String(error)}`);
    },
  });
}

/** 使用 OpenClaw 路由规则选择 agent；账号可显式覆盖默认 agentId。 */
function resolveRoute(params: {
  runtime: ChannelRuntime;
  cfg: OpenClawConfig;
  account: ResolvedClawBridgeAccount;
  conversationId: string;
}) {
  const peer = {
    kind: "direct" as const,
    id: params.conversationId,
  };
  const route = params.runtime.routing.resolveAgentRoute({
    cfg: params.cfg,
    channel: CHANNEL_ID,
    accountId: params.account.accountId,
    peer,
  });
  const agentId = params.account.agentId ?? route.agentId;
  if (agentId === route.agentId) {
    return route;
  }

  return {
    ...route,
    agentId,
    sessionKey: params.runtime.routing.buildAgentSessionKey({
      agentId,
      channel: CHANNEL_ID,
      accountId: params.account.accountId,
      peer,
    }),
  };
}

function createDirectDmRuntime(params: {
  runtime: ChannelRuntime;
  cfg: OpenClawConfig;
  account: ResolvedClawBridgeAccount;
  conversationId: string;
}) {
  return {
    channel: {
      routing: {
        resolveAgentRoute: () =>
          resolveRoute({
            runtime: params.runtime,
            cfg: params.cfg,
            account: params.account,
            conversationId: params.conversationId,
          }),
      },
      session: params.runtime.session,
      reply: params.runtime.reply,
    },
  };
}

function readStringMetadata(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseTimestampMs(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}
