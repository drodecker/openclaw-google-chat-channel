import type { GoogleChatChannelInboundPayload } from "./types.js";

/**
 * Adapter is stateless.
 * Resolve/create only through OpenClaw canonical stores.
 */
export async function resolveCanonicalEntities(params: {
  core: any;
  payload: GoogleChatChannelInboundPayload;
}) {
  const { core, payload } = params;

  const contact = await core?.contacts?.resolveOrCreate?.({
    channel: "google_chat_channel",
    externalId: payload.user.external_id,
    displayName: payload.user.display_name,
    email: payload.user.email,
  });

  const conversation = await core?.conversations?.resolveOrCreate?.({
    channel: "google_chat_channel",
    externalId: payload.conversation.external_id,
    contactExternalId: payload.user.external_id,
    isDirect: payload.conversation.is_dm,
    metadata: {
      space_id: payload.conversation.space_id,
      thread_id: payload.conversation.thread_id,
    },
  });

  return { contact, conversation };
}

export async function checkAndRecordIdempotency(params: {
  core: any;
  externalMessageId: string;
}) {
  const { core, externalMessageId } = params;
  if (!externalMessageId) return { duplicate: false };

  const seen = await core?.messages?.isDuplicateExternalId?.({
    channel: "google_chat_channel",
    externalId: externalMessageId,
  });

  if (seen) return { duplicate: true };

  await core?.messages?.recordExternalId?.({
    channel: "google_chat_channel",
    externalId: externalMessageId,
  });

  return { duplicate: false };
}
