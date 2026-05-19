import { defineSetupPluginEntry } from "openclaw/plugin-sdk/channel-core";

import { clawBridgePlugin } from "./channel.js";

export default defineSetupPluginEntry(clawBridgePlugin);
