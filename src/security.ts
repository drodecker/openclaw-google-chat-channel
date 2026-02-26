import { createHash, timingSafeEqual } from "node:crypto";

function normalizeIp(input?: string): string {
  return (input ?? "").trim();
}

function hashForSafeCompare(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function secretMatches(expected: string, actual: string): boolean {
  const a = hashForSafeCompare(expected);
  const b = hashForSafeCompare(actual);
  return timingSafeEqual(a, b);
}

export function extractRequestIp(headers: Record<string, unknown>, remoteAddress?: string): string {
  const xff = String(headers["x-forwarded-for"] ?? "").split(",")[0]?.trim();
  return normalizeIp(xff || remoteAddress || "");
}

export function assertInboundTrusted(params: {
  headers: Record<string, unknown>;
  remoteAddress?: string;
  trustedIps: string[];
  secretHeader: string;
  expectedSecret?: string;
}) {
  const ip = extractRequestIp(params.headers, params.remoteAddress);
  if (!params.trustedIps.includes(ip)) {
    throw new Error("ip_not_allowed");
  }

  const expected = (params.expectedSecret ?? "").trim();
  if (!expected) {
    throw new Error("secret_not_configured");
  }

  const got = String(params.headers[params.secretHeader.toLowerCase()] ?? "").trim();
  if (!got || !secretMatches(expected, got)) {
    throw new Error("secret_mismatch");
  }
}
