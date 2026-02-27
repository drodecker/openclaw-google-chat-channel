import {
  DEFAULT_ACCOUNT_ID,
  type ChannelDock,
  type ChannelPlugin,
} from "openclaw/plugin-sdk";
import { defaults } from "./config.js";
import { registerGoogleChatChannelWebhookTarget } from "./monitor.js";
import { renderOutbound } from "./renderer.js";

const meta = {
  id: "google_chat_channel",
  label: "Google Chat Channel",
  selectionLabel: "Google Chat Channel",
  docsPath: "/channels/google_chat_channel",
  docsLabel: "google_chat_channel",
  blurb: "Transport adapter for normalized Google Chat events forwarded by DMBot.",
  aliases: ["gcc"],
  order: 92,
  quickstartAllowFrom: false,
};

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

const resolveAccount = (cfg: any, accountId?: string) => {
  const id = (accountId ?? DEFAULT_ACCOUNT_ID).trim() || DEFAULT_ACCOUNT_ID;
  const root = cfg?.channels?.google_chat_channel ?? {};
  return {
    accountId: id,
    name: "Google Chat Channel",
    enabled: root?.enabled !== false,
    configured: true,
    config: root,
  };
};

export const googleChatChannelPlugin: ChannelPlugin<any> = {
  id: "google_chat_channel",
  meta,
  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],
    resolveAccount: (cfg, accountId) => resolveAccount(cfg, accountId),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        google_chat_channel: {
          ...(cfg.channels?.google_chat_channel ?? {}),
          enabled,
        },
      },
    }),
    deleteAccount: ({ cfg }) => cfg,
    isConfigured: () => true,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: true,
    }),
    resolveAllowFrom: () => [],
    formatAllowFrom: () => [],
    resolveDefaultTo: () => undefined,
  },
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
      const TAG = "[google_chat_channel]";
      try {
        const accountId = ctx.accountId ?? DEFAULT_ACCOUNT_ID;
        const chCfg: any = ctx.cfg.channels?.google_chat_channel ?? {};
        const path = String(chCfg?.inbound?.path ?? defaults.path);

        console.log(`${TAG} startAccount: accountId=${accountId} path=${path} hasRuntime=${!!ctx.runtime}`);

        const unregister = registerGoogleChatChannelWebhookTarget({
          path,
          cfg: chCfg,
          runtime: ctx.runtime,
        });

        ctx.setStatus({ accountId, running: true, lastStartAt: Date.now() });
        console.log(`${TAG} startAccount: running`);

        return () => {
          unregister?.();
          ctx.setStatus({ accountId, running: false, lastStopAt: Date.now() });
        };
      } catch (err) {
        console.error(`${TAG} startAccount failed:`, err);
        throw err;
      }
    },
  },
};
