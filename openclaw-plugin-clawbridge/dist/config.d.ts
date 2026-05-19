import type { ChannelConfigSchema } from "openclaw/plugin-sdk";
import type { ClawBridgeCoreConfig, ResolvedClawBridgeAccount } from "./types.js";
export declare const clawBridgeConfigSchema: ChannelConfigSchema;
/** 列出已配置的 ClawBridge 账号；未配置 named accounts 时回退到 default。 */
export declare function listClawBridgeAccountIds(cfg: ClawBridgeCoreConfig): string[];
/** 解析默认账号 ID，供 OpenClaw 启动 channel runtime 时选择账号。 */
export declare function resolveDefaultClawBridgeAccountId(cfg: ClawBridgeCoreConfig): string;
/** 合并顶层配置和账号配置，并归一化为运行时可直接使用的账号对象。 */
export declare function resolveClawBridgeAccount(params: {
    cfg: ClawBridgeCoreConfig;
    accountId?: string | null;
}): ResolvedClawBridgeAccount;
