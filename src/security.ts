import { createHash, timingSafeEqual } from "node:crypto";

function normalizeIp(input?: string): string {
  const raw = (input ?? "").trim();
  return raw.startsWith("::ffff:") ? raw.slice(7) : raw;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return (((parts[0] << 24) >>> 0) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipMatchesEntry(ip: string, entry: string): boolean {
  const rule = normalizeIp(entry);
  if (!rule) return false;
  if (!rule.includes('/')) return ip === rule;
  const [base, bitsRaw] = rule.split('/');
  const bits = Number(bitsRaw);
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt == null || baseInt == null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    return false;
  }
  const mask = bits === 0 ? 0 : ((0xffffffff << (32 - bits)) >>> 0);
  return (ipInt & mask) === (baseInt & mask);
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
  const allowed = (params.trustedIps ?? []).some((entry) => ipMatchesEntry(ip, String(entry)));
  if (!allowed) {
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
