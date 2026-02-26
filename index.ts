import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { googleChatChannelDock, googleChatChannelPlugin } from "./src/channel.js";
import { handleGoogleChatChannelInboundWebhook } from "./src/monitor.js";

const plugin = {
  id: "google_chat_channel",
  name: "Google Chat Channel (DMBot transport)",
  description: "Transport adapter for normalized Google Chat events forwarded by DMBot",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: googleChatChannelPlugin, dock: googleChatChannelDock });
    api.registerHttpHandler(handleGoogleChatChannelInboundWebhook);
  },
};

export default plugin;
