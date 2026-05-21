import { CLAWCORE_ERROR_TYPE, CLAWCORE_READY_TYPE, CLAWCORE_USER_MESSAGE_TYPE, } from "./constants.js";
import { resolveClawBridgeAccount } from "./config.js";
import { handleClawCoreUserMessage } from "./inbound.js";
import { createClawCoreWebSocket, createMessageId, decodeSocketData, sendClawCoreReply, wait, waitForSocketClose, waitForSocketOpen, } from "./transport.js";
/** 启动 channel 账号网关，保持到 ClawCore/IM `/ws/channel` 的长连接。 */
export async function startClawBridgeGatewayAccount(ctx) {
    const account = resolveClawBridgeAccount({
        cfg: ctx.cfg,
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
        }
        catch (error) {
            ctx.log?.warn?.(error instanceof Error ? error.message : String(error));
            ctx.setStatus({
                ...ctx.getStatus(),
                connected: false,
                lastError: error instanceof Error ? error.message : String(error),
            });
        }
        finally {
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
async function handleSocketMessage(params) {
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
async function dispatchUserMessage(params, message) {
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
    }
    catch (error) {
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
function parseSocketFrame(raw) {
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
    }
    catch {
        return null;
    }
}
function isClawCoreUserMessage(frame) {
    return (frame.type === CLAWCORE_USER_MESSAGE_TYPE &&
        typeof frame.id === "string" &&
        typeof frame.text === "string");
}
function readFrameMessage(frame) {
    const message = frame.message;
    return typeof message === "string" ? message : "unknown error";
}
function requireChannelRuntime(value) {
    const runtime = value;
    if (!runtime?.reply ||
        !runtime.routing ||
        !runtime.session) {
        throw new Error("OpenClaw channelRuntime is required for ClawBridge inbound dispatch");
    }
    return runtime;
}
//# sourceMappingURL=gateway.js.map