import type { OpenClawConfig, PluginRuntime } from "openclaw/plugin-sdk/channel-core";
import type { ClawCoreUserMessage, ResolvedClawBridgeAccount } from "./types.js";
type ChannelRuntime = PluginRuntime["channel"];
/** 把 ClawCore/IM 用户消息转换成 OpenClaw channel 入站上下文，并执行一次 agent turn。 */
export declare function handleClawCoreUserMessage(params: {
    cfg: OpenClawConfig;
    runtime: ChannelRuntime;
    account: ResolvedClawBridgeAccount;
    message: ClawCoreUserMessage;
}): Promise<void>;
export {};
