export const DEFAULT_SESSION_TTL_SECONDS = 30 * 60;
export const MIN_SESSION_TTL_SECONDS = 5 * 60;
export const LOGIN_RATE_LIMIT = { attempts: 10, windowSeconds: 60 } as const;
export const CACHE_TTL_SECONDS = { binding: 5 * 60, deviceState: 2 * 60 } as const;

export const kvKeys = {
  session: (id: string) => `session:${id}`,
  rateLimit: (scope: string) => `rl:${scope}`,
  deviceState: (deviceId: string) => `device:state:${deviceId}`,
  deviceBinding: (deviceId: string) => `device:binding:${deviceId}`
};

export const defaultSettings = [
  ["bootstrap.completed", "true"],
  ["app.name", "DG-LAB Cloud Console"],
  ["security.max_strength_step", "10"],
  ["security.max_message_length", "1950"],
  ["security.session_ttl_minutes", "30"],
  ["security.qr_ttl_seconds", "180"],
  ["audit.hot_retention_days", "7"],
  ["audit.archive_enabled", "true"]
] as const;

export function sessionTtlSeconds(value: string | undefined): number {
  const parsed = Number(value ?? DEFAULT_SESSION_TTL_SECONDS);
  return Number.isFinite(parsed) ? Math.max(MIN_SESSION_TTL_SECONDS, parsed) : DEFAULT_SESSION_TTL_SECONDS;
}
