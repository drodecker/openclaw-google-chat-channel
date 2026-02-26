export type GoogleChatChannelInboundPayload = {
  channel: "google_chat_channel";
  conversation: {
    external_id: string;
    space_id?: string;
    thread_id?: string;
    is_dm: boolean;
  };
  user: {
    external_id: string;
    display_name?: string;
    email?: string;
  };
  message: {
    external_id: string;
    text?: string;
    timestamp?: number;
  };
  metadata?: {
    space_type?: string;
    [key: string]: unknown;
  };
};

export type GoogleChatChannelOutboundPayload = {
  conversation_external_id: string;
  message: {
    text: string;
    actions: Array<Record<string, unknown>>;
    cards: Array<Record<string, unknown>>;
  };
};
