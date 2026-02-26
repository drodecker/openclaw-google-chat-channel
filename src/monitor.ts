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

const targets = new Map<string, Target[]>();

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

    assertInboundTrusted({
      headers: req.headers as Record<string, unknown>,
      remoteAddress: req.socket?.remoteAddress,
      trustedIps: target.cfg?.inbound?.trustedIps ?? [],
      secretHeader: String(target.cfg?.inbound?.sharedSecretHeader ?? defaults.header).toLowerCase(),
      expectedSecret: target.cfg?.inbound?.sharedSecret,
    });

    if (inbound?.channel !== "google_chat_channel") {
      res.statusCode = 400;
      res.end("invalid channel");
      return true;
    }

    const idempotency = await checkAndRecordIdempotency({
      core: target.runtime,
      externalMessageId: inbound.message?.external_id,
    });

    if (idempotency.duplicate) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end('{"ok":true,"duplicate":true}');
      return true;
    }

    await resolveCanonicalEntities({ core: target.runtime, payload: inbound });
    const canonical = normalizeInboundToCanonical(inbound);

    // Canonical routing only; no Google-specific prompt behavior.
    await target.runtime?.inbound?.dispatch?.(canonical);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end('{"ok":true}');
    return true;
  } catch (err) {
    const code = String((err as Error)?.message ?? "");
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
