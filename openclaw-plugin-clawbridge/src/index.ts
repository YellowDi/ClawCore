import { defineChannelPluginEntry } from "openclaw/plugin-sdk/channel-core";

import { clawBridgePlugin } from "./channel.js";
import { clawBridgeConfigSchema } from "./config.js";
import { setClawBridgeRuntime } from "./runtime.js";

export default defineChannelPluginEntry({
  id: "clawbridge",
  name: "ClawBridge",
  description: "ClawPro IM channel plugin for OpenClaw.",
  plugin: clawBridgePlugin,
  configSchema: clawBridgeConfigSchema,
  setRuntime: setClawBridgeRuntime,
});
