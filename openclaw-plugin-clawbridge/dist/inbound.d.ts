import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { ClawCoreUserMessage, ResolvedClawBridgeAccount } from "./types.js";
type ChannelRuntime = PluginRuntime["channel"];
/** 把 ClawCore 用户消息转换成 OpenClaw 入站上下文，并执行一次 agent turn。 */
export declare function handleClawCoreUserMessage(params: {
    cfg: Parameters<ChannelRuntime["routing"]["resolveAgentRoute"]>[0]["cfg"];
    runtime: ChannelRuntime;
    account: ResolvedClawBridgeAccount;
    message: ClawCoreUserMessage;
}): Promise<void>;
export {};
