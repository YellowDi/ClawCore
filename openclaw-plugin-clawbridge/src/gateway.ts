import type { ChannelGatewayContext } from "openclaw/plugin-sdk/channel-contract";
import type { PluginRuntime } from "openclaw/plugin-sdk/channel-core";

import {
  CLAWCORE_ERROR_TYPE,
  CLAWCORE_READY_TYPE,
  CLAWCORE_USER_MESSAGE_TYPE,
} from "./constants.js";
import { resolveClawBridgeAccount } from "./config.js";
import { handleClawCoreUserMessage } from "./inbound.js";
import {
  createClawCoreWebSocket,
  createMessageId,
  decodeSocketData,
  sendClawCoreReply,
  wait,
  waitForSocketClose,
  waitForSocketOpen,
} from "./transport.js";
import type { ClawBridgeCoreConfig, ClawCoreUserMessage, ResolvedClawBridgeAccount } from "./types.js";

type ChannelRuntime = PluginRuntime["channel"];

/** 启动 channel 账号网关，保持到 ClawCore/IM `/ws/channel` 的长连接。 */
export async function startClawBridgeGatewayAccount(
  ctx: ChannelGatewayContext<ResolvedClawBridgeAccount>,
): Promise<void> {
  const account = resolveClawBridgeAccount({
    cfg: ctx.cfg as ClawBridgeCoreConfig,
    accountId: ctx.account.accountId,
  });
  if (!account.configured) {
    throw new Error(`ClawBridge account "${account.accountId}" is not configured`);
  }

  const runtime = requireChannelRuntime(ctx.channelRuntime);
  ctx.setStatus({
    accountId: account.accountId,
    running: true,
    configured: true,
    enabled: account.enabled,
    baseUrl: account.serverUrl,
  });

  while (!ctx.abortSignal.aborted) {
    const socket = createClawCoreWebSocket(account);
    try {
      await waitForSocketOpen(socket, ctx.abortSignal);
      if (ctx.abortSignal.aborted) {
        break;
      }

      ctx.setStatus({
        ...ctx.getStatus(),
        connected: true,
        running: true,
        lastConnectedAt: Date.now(),
        lastError: null,
      });
      socket.addEventListener("message", (event) => {
        void handleSocketMessage({
          ctx,
          runtime,
          account,
          data: event.data,
        }).catch((error) => {
          ctx.log?.error?.(error instanceof Error ? error.message : String(error));
        });
      });
      await waitForSocketClose(socket, ctx.abortSignal);
    } catch (error) {
      ctx.log?.warn?.(error instanceof Error ? error.message : String(error));
      ctx.setStatus({
        ...ctx.getStatus(),
        connected: false,
        lastError: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    }

    if (!ctx.abortSignal.aborted) {
      await wait(account.reconnectMs, ctx.abortSignal);
    }
  }

  ctx.setStatus({
    ...ctx.getStatus(),
    running: false,
    connected: false,
  });
}

async function handleSocketMessage(params: {
  ctx: ChannelGatewayContext<ResolvedClawBridgeAccount>;
  runtime: ChannelRuntime;
  account: ResolvedClawBridgeAccount;
  data: unknown;
}): Promise<void> {
  const raw = await decodeSocketData(params.data);
  const frame = parseSocketFrame(raw);
  if (!frame) {
    return;
  }

  if (frame.type === CLAWCORE_READY_TYPE) {
    params.ctx.log?.info?.(`[${params.account.accountId}] connected to ClawCore channel`);
    return;
  }
  if (frame.type === CLAWCORE_ERROR_TYPE) {
    params.ctx.log?.warn?.(`[${params.account.accountId}] ClawCore error: ${readFrameMessage(frame)}`);
    return;
  }
  if (isClawCoreUserMessage(frame)) {
    await dispatchUserMessage(params, frame);
  }
}

/** 将 ClawCore/IM 推来的用户消息交给 OpenClaw turn kernel，并把失败显式回传给浏览器。 */
async function dispatchUserMessage(
  params: {
    ctx: ChannelGatewayContext<ResolvedClawBridgeAccount>;
    runtime: ChannelRuntime;
    account: ResolvedClawBridgeAccount;
  },
  message: ClawCoreUserMessage,
): Promise<void> {
  try {
    params.ctx.setStatus({
      ...params.ctx.getStatus(),
      lastInboundAt: Date.now(),
    });
    await handleClawCoreUserMessage({
      cfg: params.ctx.cfg,
      runtime: params.runtime,
      account: params.account,
      message,
    });
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    await sendClawCoreReply({
      account: params.account,
      message: {
        conversationId: message.conversationId?.trim() || params.account.defaultTo,
        replyTo: message.id,
        messageId: createMessageId("clawbridge-error"),
        text,
        state: "error",
      },
    });
  }
}

function parseSocketFrame(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isClawCoreUserMessage(frame: Record<string, unknown>): frame is ClawCoreUserMessage {
  return (
    frame.type === CLAWCORE_USER_MESSAGE_TYPE &&
    typeof frame.id === "string" &&
    typeof frame.text === "string"
  );
}

function readFrameMessage(frame: Record<string, unknown>): string {
  const message = frame.message;
  return typeof message === "string" ? message : "unknown error";
}

function requireChannelRuntime(value: unknown): ChannelRuntime {
  const runtime = value as Partial<ChannelRuntime> | undefined;
  if (
    !runtime?.reply ||
    !runtime.routing ||
    !runtime.session
  ) {
    throw new Error("OpenClaw channelRuntime is required for ClawBridge inbound dispatch");
  }
  return runtime as ChannelRuntime;
}
