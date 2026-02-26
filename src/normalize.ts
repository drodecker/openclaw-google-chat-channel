import type { GoogleChatChannelInboundPayload } from "./types.js";

export function normalizeInboundToCanonical(payload: GoogleChatChannelInboundPayload) {
  const text = (payload.message?.text ?? "").trim();
  return {
    channel: "google_chat_channel",
    provider: "google_chat_channel",
    surface: "google_chat_channel",
    messageId: payload.message.external_id,
    text,
    timestamp: payload.message.timestamp,
    from: payload.user.external_id,
    fromName: payload.user.display_name,
    fromEmail: payload.user.email,
    to: payload.conversation.external_id,
    chatType: payload.conversation.is_dm ? "direct" : "group",
    replyToId: payload.conversation.thread_id,
    metadata: {
      space_id: payload.conversation.space_id,
      thread_id: payload.conversation.thread_id,
      space_type: payload.metadata?.space_type,
      ...payload.metadata,
    },
  };
}
