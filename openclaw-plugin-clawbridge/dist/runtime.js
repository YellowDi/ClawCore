import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";
const store = createPluginRuntimeStore({
    pluginId: "clawbridge",
    errorMessage: "ClawBridge runtime has not been initialized",
});
export const setClawBridgeRuntime = store.setRuntime;
export const getClawBridgeRuntime = store.getRuntime;
//# sourceMappingURL=runtime.js.map