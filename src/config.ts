import { Type } from "@sinclair/typebox";

export const GoogleChatChannelConfigSchema = Type.Object({
  enabled: Type.Optional(Type.Boolean({ default: true })),
  inbound: Type.Optional(
    Type.Object({
      path: Type.Optional(Type.String({ default: "/google-chat-channel/inbound" })),
      sharedSecretHeader: Type.Optional(Type.String({ default: "x-dmbot-secret" })),
      sharedSecret: Type.Optional(Type.String()),
      trustedIps: Type.Optional(Type.Array(Type.String(), { default: [] })),
    }),
  ),
  outbound: Type.Optional(
    Type.Object({
      dmBotWebhookUrl: Type.Optional(Type.String()),
      timeoutMs: Type.Optional(Type.Number({ default: 10000 })),
      maxTextChars: Type.Optional(Type.Number({ default: 3500 })),
    }),
  ),
  roleMapping: Type.Optional(
    Type.Object({
      enabled: Type.Optional(Type.Boolean({ default: false })),
      domainRules: Type.Optional(Type.Array(Type.Unknown(), { default: [] })),
    }),
  ),
});

export const defaults = {
  path: "/google-chat-channel/inbound",
  header: "x-dmbot-secret",
  maxTextChars: 3500,
};
