/** 归一化用户输入的目标会话，支持 clawbridge:main 和裸 main 两种写法。 */
export declare function normalizeClawBridgeTarget(raw: string): string;
/** 判断一个字符串是否可作为 ClawBridge 会话目标。 */
export declare function looksLikeClawBridgeTarget(raw: string): boolean;
