import { type ChannelPlugin } from "openclaw/plugin-sdk/channel-core";
import type { ResolvedClawBridgeAccount } from "./types.js";
/** OpenClaw 原生 channel 插件定义，注册配置、路由、网关和出站投递能力。 */
export declare const clawBridgePlugin: ChannelPlugin<ResolvedClawBridgeAccount>;
