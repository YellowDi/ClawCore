import type { ChannelGatewayContext } from "openclaw/plugin-sdk/channel-contract";
import type { ResolvedClawBridgeAccount } from "./types.js";
/** 启动 channel 账号网关，保持到 ClawCore/IM `/ws/channel` 的长连接。 */
export declare function startClawBridgeGatewayAccount(ctx: ChannelGatewayContext<ResolvedClawBridgeAccount>): Promise<void>;
