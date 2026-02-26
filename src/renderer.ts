import type { GoogleChatChannelOutboundPayload } from "./types.js";

function stripUnsupportedMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .trim();
}

function truncate(input: string, max: number): string {
  return input.length > max ? `${input.slice(0, Math.max(0, max - 1))}…` : input;
}

export function renderOutbound(params: {
  conversationExternalId: string;
  text?: string;
  actions?: Array<Record<string, unknown>>;
  cards?: Array<Record<string, unknown>>;
  maxTextChars: number;
}): GoogleChatChannelOutboundPayload {
  const safe = truncate(stripUnsupportedMarkdown(params.text ?? ""), params.maxTextChars);

  return {
    conversation_external_id: params.conversationExternalId,
    message: {
      text: safe,
      actions: params.actions ?? [],
      cards: params.cards ?? [],
    },
  };
}
