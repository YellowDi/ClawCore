import { createChannelMessageReplyPipeline } from "openclaw/plugin-sdk/channel-message";
import type { PluginRuntime } from "openclaw/plugin-sdk/core";

import { CHANNEL_ID, CHANNEL_LABEL } from "./constants.js";
import { createMessageId, extractReplyText, sendClawCoreReply } from "./transport.js";
import type { ClawCoreUserMessage, ResolvedClawBridgeAccount } from "./types.js";

type ChannelRuntime = PluginRuntime["channel"];

/** 把 ClawCore 用户消息转换成 OpenClaw 入站上下文，并执行一次 agent turn。 */
export async function handleClawCoreUserMessage(params: {
  cfg: Parameters<ChannelRuntime["routing"]["resolveAgentRoute"]>[0]["cfg"];
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
  const route = resolveRoute({
    runtime: params.runtime,
    cfg: params.cfg,
    account: params.account,
    conversationId,
  });
  const storePath = params.runtime.session.resolveStorePath(params.cfg.session?.store, {
    agentId: route.agentId,
  });
  const previousTimestamp = params.runtime.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });
  const timestamp = parseTimestamp(params.message.createdAt);
  const body = params.runtime.reply.formatAgentEnvelope({
    channel: CHANNEL_LABEL,
    from: senderName,
    timestamp,
    previousTimestamp,
    envelope: params.runtime.reply.resolveEnvelopeFormatOptions(params.cfg),
    body: text,
  });
  const ctxPayload = params.runtime.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: text,
    RawBody: text,
    CommandBody: text,
    From: conversationId,
    To: conversationId,
    SessionKey: route.sessionKey,
    AccountId: route.accountId ?? params.account.accountId,
    ChatType: "direct",
    ConversationLabel: conversationId,
    SenderName: senderName,
    SenderId: readStringMetadata(params.message.metadata, "senderId") ?? "clawbridge-user",
    Provider: CHANNEL_ID,
    Surface: CHANNEL_LABEL,
    MessageSid: params.message.id,
    MessageSidFull: params.message.id,
    ReplyToId: params.message.id,
    Timestamp: timestamp?.getTime(),
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: conversationId,
    CommandAuthorized: true,
  });
  const replyPipeline = createChannelMessageReplyPipeline({
    cfg: params.cfg,
    agentId: route.agentId,
    channel: CHANNEL_ID,
    accountId: params.account.accountId,
  });
  const assistantMessageId = createMessageId("clawbridge-in");

  await params.runtime.turn.runPrepared({
    channel: CHANNEL_ID,
    accountId: params.account.accountId,
    routeSessionKey: route.sessionKey,
    storePath,
    ctxPayload,
    recordInboundSession: params.runtime.session.recordInboundSession,
    runDispatch: async () =>
      await params.runtime.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx: ctxPayload,
        cfg: params.cfg,
        dispatcherOptions: {
          ...replyPipeline,
          deliver: async (payload, info) => {
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
                state: payload.isError ? "error" : info.kind === "final" ? "final" : "delta",
              },
            });
          },
          onError: (error) => {
            throw error instanceof Error
              ? error
              : new Error(`ClawBridge dispatch failed: ${String(error)}`);
          },
        },
      }),
    record: {
      onRecordError: (error) => {
        throw error instanceof Error
          ? error
          : new Error(`ClawBridge session record failed: ${String(error)}`);
      },
    },
  });
}

/** 使用 OpenClaw 路由规则选择 agent；账号可显式覆盖默认 agentId。 */
function resolveRoute(params: {
  runtime: ChannelRuntime;
  cfg: Parameters<ChannelRuntime["routing"]["resolveAgentRoute"]>[0]["cfg"];
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

function readStringMetadata(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseTimestamp(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms) : undefined;
}
