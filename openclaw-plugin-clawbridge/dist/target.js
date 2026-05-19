import { DEFAULT_CONVERSATION_ID } from "./constants.js";
/** 归一化用户输入的目标会话，支持 clawbridge:main 和裸 main 两种写法。 */
export function normalizeClawBridgeTarget(raw) {
    const value = raw.trim().replace(/^(clawbridge|clawcore):/i, "").trim();
    return value || DEFAULT_CONVERSATION_ID;
}
/** 判断一个字符串是否可作为 ClawBridge 会话目标。 */
export function looksLikeClawBridgeTarget(raw) {
    return normalizeClawBridgeTarget(raw).length > 0;
}
//# sourceMappingURL=target.js.map