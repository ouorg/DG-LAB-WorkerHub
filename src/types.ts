export interface Env {
  DB: D1Database;
  SESSION_KV: KVNamespace;
  RATE_LIMIT_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  ASSETS_BUCKET: R2Bucket;
  ARCHIVE_BUCKET: R2Bucket;
  DEVICE_DO: DurableObjectNamespace;
  SOCKET_V2_DO: DurableObjectNamespace;
  LOGIN_PASSWORD: string;
  BOOTSTRAP_TOKEN: string;
  SESSION_TTL_SECONDS?: string;
  SOCKET_PULSE_INTERVAL_MS?: string;
  HEARTBEAT_INTERVAL?: string;
}

export interface User { id: string; name: string; createdAt: string }
export interface Session { id: string; userId: string; expiresAt: string }
export interface Device {
  id: string;
  ownerId: string;
  name: string;
  appToken: string;
  createdAt: string;
}
export interface AuditLog {
  id: string;
  deviceId: string;
  userId: string;
  action: string;
  detail: unknown;
  createdAt: string;
}
export interface DeviceState {
  online: boolean;
  strengths: { A: number; B: number };
  clientId?: string;
  targetId?: string;
  lastHeartbeat?: string;
  lastFeedback?: string;
  queueDepth: number;
  controlPermission?: string;
}
