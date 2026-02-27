import type { IncomingMessage, ServerResponse } from "node:http";
import {
  readJsonBodyWithLimit,
  registerWebhookTarget,
  rejectNonPostWebhookRequest,
  requestBodyErrorToText,
  resolveWebhookTargets,
} from "openclaw/plugin-sdk";
import { defaults } from "./config.js";
import { normalizeInboundToCanonical } from "./normalize.js";
import { checkAndRecordIdempotency, resolveCanonicalEntities } from "./resolver.js";
import { assertInboundTrusted } from "./security.js";
import type { GoogleChatChannelInboundPayload } from "./types.js";

type Target = {
  path: string;
  cfg: any;
  runtime: any;
};

const TAG = "[google_chat_channel]";
const targets = new Map<string, Target[]>();

function summarize(inbound: GoogleChatChannelInboundPayload): string {
  const space = inbound.conversation?.space_id ?? "?";
  const thread = inbound.conversation?.thread_id ?? "-";
  const extId = inbound.conversation?.external_id ?? "?";
  const dm = inbound.conversation?.is_dm ? "dm" : "group";
  const user = inbound.user?.display_name ?? inbound.user?.email ?? inbound.user?.external_id ?? "?";
  const msgId = inbound.message?.external_id ?? "?";
  const text = (inbound.message?.text ?? "").slice(0, 500);
  return `space=${space} thread=${thread} conv=${extId} type=${dm} from=${user} msgId=${msgId} text=${JSON.stringify(text)}`;
}

export function registerGoogleChatChannelWebhookTarget(target: Target): () => void {
  return registerWebhookTarget(targets, target).unregister;
}

export async function handleGoogleChatChannelInboundWebhook(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const resolved = resolveWebhookTargets(req, targets);
  if (!resolved) return false;

  if (rejectNonPostWebhookRequest(req, res)) return true;

  const { targets: matched } = resolved;
  const target = matched[0];
  if (!target) {
    res.statusCode = 404;
    res.end("not found");
    return true;
  }

  const body = await readJsonBodyWithLimit(req, {
    maxBytes: 1024 * 1024,
    timeoutMs: 30_000,
    emptyObjectOnEmpty: false,
  });

  if (!body.ok) {
    res.statusCode =
      body.code === "PAYLOAD_TOO_LARGE" ? 413 : body.code === "REQUEST_BODY_TIMEOUT" ? 408 : 400;
    res.end(
      body.code === "REQUEST_BODY_TIMEOUT"
        ? requestBodyErrorToText("REQUEST_BODY_TIMEOUT")
        : body.error,
    );
    return true;
  }

  try {
    const inbound = body.value as GoogleChatChannelInboundPayload;

    console.log(`${TAG} inbound: ${summarize(inbound)}`);

    assertInboundTrusted({
      headers: req.headers as Record<string, unknown>,
      remoteAddress: req.socket?.remoteAddress,
      trustedIps: target.cfg?.inbound?.trustedIps ?? [],
      secretHeader: String(target.cfg?.inbound?.sharedSecretHeader ?? defaults.header).toLowerCase(),
      expectedSecret: target.cfg?.inbound?.sharedSecret,
    });

    if (inbound?.channel !== "google_chat_channel") {
      console.log(`${TAG} rejected: channel=${inbound?.channel} (expected google_chat_channel)`);
      res.statusCode = 400;
      res.end("invalid channel");
      return true;
    }

    const idempotency = await checkAndRecordIdempotency({
      core: target.runtime,
      externalMessageId: inbound.message?.external_id,
    });

    if (idempotency.duplicate) {
      console.log(`${TAG} duplicate msgId=${inbound.message?.external_id}, skipping`);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end('{"ok":true,"duplicate":true}');
      return true;
    }

    await resolveCanonicalEntities({ core: target.runtime, payload: inbound });
    const canonical = normalizeInboundToCanonical(inbound);

    // Canonical routing only; no Google-specific prompt behavior.
    const hasInbound = !!target.runtime?.inbound;
    const hasDispatch = typeof target.runtime?.inbound?.dispatch;
    console.log(`${TAG} dispatch check: hasRuntime=${!!target.runtime} hasInbound=${hasInbound} dispatchType=${hasDispatch}`);
    const result = await target.runtime?.inbound?.dispatch?.(canonical);
    console.log(`${TAG} dispatch result:`, result);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end('{"ok":true}');
    return true;
  } catch (err) {
    const code = String((err as Error)?.message ?? "");
    console.log(`${TAG} error: ${code || (err as Error)?.stack || err}`);
    if (code === "ip_not_allowed" || code === "secret_mismatch" || code === "secret_not_configured") {
      res.statusCode = 401;
      res.end("unauthorized");
      return true;
    }

    res.statusCode = 500;
    res.end("internal_error");
    return true;
  }
}
