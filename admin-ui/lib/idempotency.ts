const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function randomSuffix() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function idempotencyKeyFor(method: string, endpoint: string, body?: unknown) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) return undefined;
  if (endpoint.startsWith("/api/auth/request-otp") || endpoint.startsWith("/api/auth/verify-otp") || endpoint.startsWith("/api/auth/refresh")) return undefined;
  if (typeof window === "undefined") return `srv-${hash(`${method}:${endpoint}:${stableStringify(body)}`)}-${randomSuffix()}`;

  const fingerprint = hash(`${method.toUpperCase()}:${endpoint}:${stableStringify(body ?? {})}`);
  const storageKey = `sora-idempotency:${fingerprint}`;
  const now = Date.now();
  try {
    const cached = window.sessionStorage.getItem(storageKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { key: string; expiresAt: number };
      if (parsed.expiresAt > now && parsed.key) return parsed.key;
    }
    const key = `sora-${fingerprint}-${randomSuffix()}`;
    window.sessionStorage.setItem(storageKey, JSON.stringify({ key, expiresAt: now + IDEMPOTENCY_TTL_MS }));
    return key;
  } catch {
    return `sora-${fingerprint}-${randomSuffix()}`;
  }
}

export function idempotencyKeyForForm(method: string, endpoint: string, formData: FormData) {
  const entries: Array<[string, string]> = [];
  formData.forEach((value, key) => {
    if (value instanceof File) entries.push([key, `${value.name}:${value.size}:${value.lastModified}`]);
    else entries.push([key, String(value)]);
  });
  return idempotencyKeyFor(method, endpoint, entries);
}
