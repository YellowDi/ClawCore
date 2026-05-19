import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";
import type { PluginRuntime } from "openclaw/plugin-sdk/core";

const store = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "clawbridge",
  errorMessage: "ClawBridge runtime has not been initialized",
});

export const setClawBridgeRuntime = store.setRuntime;
export const getClawBridgeRuntime = store.getRuntime;
