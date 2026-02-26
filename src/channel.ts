import {
  getChatChannelMeta,
  type ChannelDock,
  type ChannelPlugin,
} from "openclaw/plugin-sdk";
import { defaults } from "./config.js";
import { registerGoogleChatChannelWebhookTarget } from "./monitor.js";
import { renderOutbound } from "./renderer.js";

const meta = getChatChannelMeta("google_chat_channel");

export const googleChatChannelDock: ChannelDock = {
  id: "google_chat_channel",
  capabilities: {
    chatTypes: ["direct", "group", "thread"],
    threads: true,
    media: false,
    reactions: false,
    blockStreaming: true,
  },
  outbound: { textChunkLimit: 3500 },
};

export const googleChatChannelPlugin: ChannelPlugin<any> = {
  id: "google_chat_channel",
  meta,
  capabilities: {
    chatTypes: ["direct", "group", "thread"],
    threads: true,
    media: false,
    reactions: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 3500,
    resolveTarget: ({ to }) => {
      const value = (to ?? "").trim();
      if (!value) {
        return { ok: false, error: "Missing target conversation_external_id" };
      }
      return { ok: true, to: value };
    },
    sendText: async ({ cfg, to, text }) => {
      const chCfg: any = cfg.channels?.google_chat_channel ?? {};
      const url = chCfg?.outbound?.dmBotWebhookUrl;
      if (!url) throw new Error("google_chat_channel outbound.dmBotWebhookUrl is not configured");

      const payload = renderOutbound({
        conversationExternalId: to,
        text,
        actions: [],
        cards: [],
        maxTextChars: Number(chCfg?.outbound?.maxTextChars ?? defaults.maxTextChars),
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`google_chat_channel outbound failed: HTTP ${response.status}`);
      }

      return {
        channel: "google_chat_channel",
        messageId: "",
        chatId: to,
      };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const accountId = ctx.account.accountId;
      const chCfg: any = ctx.cfg.channels?.google_chat_channel ?? {};
      const path = String(chCfg?.inbound?.path ?? defaults.path);

      const unregister = registerGoogleChatChannelWebhookTarget({
        path,
        cfg: chCfg,
        runtime: ctx.runtime,
      });

      ctx.setStatus({ accountId, running: true, lastStartAt: Date.now() });

      return () => {
        unregister?.();
        ctx.setStatus({ accountId, running: false, lastStopAt: Date.now() });
      };
    },
  },
};
