import { CACHE_TTL_SECONDS, kvKeys, sessionTtlSeconds } from "./config";
import type { AuditLog, Device, Env, Session } from "../types";
import { bootstrapDb } from "../storage/bootstrap";
import { incrementWindow, readJson, writeJson } from "../storage/kv";
import { sql } from "../storage/sql";

const now = () => new Date().toISOString();
const tokenHash = async (value: string) => Array.from(
  new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
  byte => byte.toString(16).padStart(2, "0")
).join("");

interface DeviceRow { id: string; owner_user_id: string; name: string; app_token: string; created_at: string }
interface AuditRow { id: string; device_id: string; user_id: string; action: string; request_json: string | null; created_at: string }
const deviceFromRow = (row: DeviceRow): Device => ({ id: row.id, ownerId: row.owner_user_id, name: row.name, appToken: row.app_token, createdAt: row.created_at });
const auditFromRow = (row: AuditRow): AuditLog => ({
  id: row.id,
  deviceId: row.device_id,
  userId: row.user_id,
  action: row.action,
  detail: row.request_json ? JSON.parse(row.request_json) : null,
  createdAt: row.created_at
});
import type { AuditLog, Device, Env, Session } from "../types";
import { bootstrapDb } from "../storage/bootstrap";
import { incrementWindow, readJson, writeJson } from "../storage/kv";

const now = () => new Date().toISOString();
const tokenHash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, "0")).join("");
interface DeviceRow { id: string; owner_user_id: string; name: string; app_token: string; created_at: string }
interface AuditRow { id: string; device_id: string; user_id: string; action: string; request_json: string | null; created_at: string }
const deviceFromRow = (row: DeviceRow): Device => ({ id: row.id, ownerId: row.owner_user_id, name: row.name, appToken: row.app_token, createdAt: row.created_at });
const auditFromRow = (row: AuditRow): AuditLog => ({ id: row.id, deviceId: row.device_id, userId: row.user_id, action: row.action, detail: row.request_json ? JSON.parse(row.request_json) : null, createdAt: row.created_at });

export class Store {
  private bootstrapped = false;
  constructor(private readonly env: Env) {}

  async bootstrap(): Promise<void> {
    if (this.bootstrapped) return;
    await bootstrapDb(this.env);
    this.bootstrapped = true;
  }

  async createSession(): Promise<Session> {
    await this.bootstrap();
    const ttl = sessionTtlSeconds(this.env.SESSION_TTL_SECONDS);
    const createdAt = now(), id = crypto.randomUUID();
    const session: Session = { id, userId: "bootstrap", expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
    await this.env.DB.prepare(sql.insertSession)
      .bind(id, session.userId, await tokenHash(id), createdAt, createdAt, session.expiresAt).run();
    await writeJson(this.env.HUB_KV, kvKeys.session(id), session, ttl);

  async createSession(): Promise<Session> {
    await this.bootstrap();
    const ttl = sessionTtlSeconds(this.env.SESSION_TTL_SECONDS);
    const createdAt = now(), id = crypto.randomUUID();
    const session: Session = { id, userId: "bootstrap", expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
    await this.env.DB.prepare(sql.insertSession)
      .bind(id, session.userId, await tokenHash(id), createdAt, createdAt, session.expiresAt).run();
    await writeJson(this.env.HUB_KV, kvKeys.session(id), session, ttl);

  async createSession(): Promise<Session> {
    await this.bootstrap();
    const ttl = sessionTtlSeconds(this.env.SESSION_TTL_SECONDS);
    const createdAt = now(), id = crypto.randomUUID();
    const session: Session = { id, userId: "bootstrap", expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
    await this.env.DB.prepare(sql.insertSession)
      .bind(id, session.userId, await tokenHash(id), createdAt, createdAt, session.expiresAt).run();
    await writeJson(this.env.HUB_KV, kvKeys.session(id), session, ttl);
  async bootstrap(): Promise<void> { if (!this.bootstrapped) { await bootstrapDb(this.env); this.bootstrapped = true; } }

  async createSession(): Promise<Session> {
    await this.bootstrap();
    const ttl = Math.max(300, Number(this.env.SESSION_TTL_SECONDS ?? 1800));
    const createdAt = now(), id = crypto.randomUUID();
    const session: Session = { id, userId: "bootstrap", expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
    await this.env.DB.prepare("INSERT INTO sessions (id, user_id, kind, state, token_hash, created_at, updated_at, expires_at) VALUES (?, ?, 'login', 'active', ?, ?, ?, ?)").bind(id, session.userId, await tokenHash(id), createdAt, createdAt, session.expiresAt).run();
    await writeJson(this.env.HUB_KV, `session:${id}`, session, ttl);
    await writeJson(this.env.SESSION_KV, `session:${id}`, session, ttl);
    return session;
  }

  async session(id: string): Promise<Session | null> {
    const session = await readJson<Session>(this.env.HUB_KV, kvKeys.session(id));
    const session = await readJson<Session>(this.env.HUB_KV, `session:${id}`);
    const session = await readJson<Session>(this.env.SESSION_KV, `session:${id}`);
    return session && Date.parse(session.expiresAt) > Date.now() ? session : null;
  }

  async createDevice(ownerId: string, name: string): Promise<Device> {
    await this.bootstrap();
    const createdAt = now(), device: Device = { id: crypto.randomUUID(), ownerId, name, appToken: crypto.randomUUID(), createdAt };
    await this.env.DB.prepare(sql.insertDevice)
      .bind(device.id, ownerId, name, device.appToken, createdAt, createdAt).run();
    await this.env.DB.prepare("INSERT INTO devices (id, owner_user_id, name, app_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(device.id, ownerId, name, device.appToken, createdAt, createdAt).run();
    return device;
  }

  async device(id: string): Promise<Device | null> {
    await this.bootstrap();
    const row = await this.env.DB.prepare(sql.selectDevice)
      .bind(id).first<DeviceRow>();
    const row = await this.env.DB.prepare("SELECT id, owner_user_id, name, app_token, created_at FROM devices WHERE id = ?").bind(id).first<DeviceRow>();
    return row ? deviceFromRow(row) : null;
  }

  async devices(ownerId: string): Promise<Device[]> {
    await this.bootstrap();
    const rows = await this.env.DB.prepare(sql.selectDevicesByOwner)
      .bind(ownerId).all<DeviceRow>();
    const rows = await this.env.DB.prepare("SELECT id, owner_user_id, name, app_token, created_at FROM devices WHERE owner_user_id = ? ORDER BY created_at").bind(ownerId).all<DeviceRow>();
    return (rows.results ?? []).map(deviceFromRow);
  }

  async defaultDevice(ownerId: string): Promise<{ device: Device; created: boolean }> {
    const [device] = await this.devices(ownerId);
    return device ? { device, created: false } : { device: await this.createDevice(ownerId, "默认设备"), created: true };
  }

  async audit(userId: string, deviceId: string, action: string, detail: unknown): Promise<void> {
    await this.env.DB.prepare(sql.insertAuditLog)
      .bind(crypto.randomUUID(), userId, deviceId, action, JSON.stringify(detail), now()).run();
  }

  async logs(deviceId: string): Promise<AuditLog[]> {
    const rows = await this.env.DB.prepare(sql.selectAuditLogsByDevice)
      .bind(deviceId).all<AuditRow>();
    return (rows.results ?? []).map(auditFromRow);
  }

  async saveBinding(deviceId: string, clientId: string, targetId: string): Promise<void> {
    const timestamp = now();
    await this.env.DB.prepare(sql.upsertDeviceBinding)
      .bind(crypto.randomUUID(), deviceId, clientId, targetId, timestamp, timestamp).run();
    await writeJson(this.env.HUB_KV, kvKeys.deviceBinding(deviceId), { clientId, targetId, state: "active", updatedAt: timestamp }, CACHE_TTL_SECONDS.binding);
  }

  async clearBinding(deviceId: string): Promise<void> {
    await this.env.DB.prepare(sql.closeDeviceBinding).bind(now(), deviceId).run();
    await this.env.HUB_KV.delete(kvKeys.deviceBinding(deviceId));
  }

  async cacheState(deviceId: string, state: unknown): Promise<void> {
    await writeJson(this.env.HUB_KV, kvKeys.deviceState(deviceId), state, CACHE_TTL_SECONDS.deviceState);
  }

  rateLimit(key: string, limit: number, ttl: number): Promise<boolean> {
    return incrementWindow(this.env.HUB_KV, kvKeys.rateLimit(key), limit, ttl);
  }

  async saveBinding(deviceId: string, clientId: string, targetId: string): Promise<void> {
    const timestamp = now();
    await this.env.DB.prepare(sql.upsertDeviceBinding)
      .bind(crypto.randomUUID(), deviceId, clientId, targetId, timestamp, timestamp).run();
    await writeJson(this.env.HUB_KV, kvKeys.deviceBinding(deviceId), { clientId, targetId, state: "active", updatedAt: timestamp }, CACHE_TTL_SECONDS.binding);
  }

  async clearBinding(deviceId: string): Promise<void> {
    await this.env.DB.prepare(sql.closeDeviceBinding).bind(now(), deviceId).run();
    await this.env.HUB_KV.delete(kvKeys.deviceBinding(deviceId));
  }

  async cacheState(deviceId: string, state: unknown): Promise<void> {
    await writeJson(this.env.HUB_KV, kvKeys.deviceState(deviceId), state, CACHE_TTL_SECONDS.deviceState);
  }

  rateLimit(key: string, limit: number, ttl: number): Promise<boolean> {
    return incrementWindow(this.env.HUB_KV, kvKeys.rateLimit(key), limit, ttl);
  }

  async saveBinding(deviceId: string, clientId: string, targetId: string): Promise<void> {
    const timestamp = now();
    await this.env.DB.prepare(sql.upsertDeviceBinding)
      .bind(crypto.randomUUID(), deviceId, clientId, targetId, timestamp, timestamp).run();
    await writeJson(this.env.HUB_KV, kvKeys.deviceBinding(deviceId), { clientId, targetId, state: "active", updatedAt: timestamp }, CACHE_TTL_SECONDS.binding);
  }

  async clearBinding(deviceId: string): Promise<void> {
    await this.env.DB.prepare(sql.closeDeviceBinding).bind(now(), deviceId).run();
    await this.env.HUB_KV.delete(kvKeys.deviceBinding(deviceId));
  }

  async cacheState(deviceId: string, state: unknown): Promise<void> {
    await writeJson(this.env.HUB_KV, kvKeys.deviceState(deviceId), state, CACHE_TTL_SECONDS.deviceState);
  }

  rateLimit(key: string, limit: number, ttl: number): Promise<boolean> {
    return incrementWindow(this.env.HUB_KV, kvKeys.rateLimit(key), limit, ttl);
  }

  async defaultDevice(ownerId: string): Promise<{ device: Device; created: boolean }> {
    const [device] = await this.devices(ownerId);
    return device ? { device, created: false } : { device: await this.createDevice(ownerId, "默认设备"), created: true };
  }

  async audit(userId: string, deviceId: string, action: string, detail: unknown): Promise<void> {
    const createdAt = now();
    await this.env.DB.prepare("INSERT INTO audit_logs (id, user_id, device_id, source, action, request_json, created_at) VALUES (?, ?, ?, 'worker', ?, ?, ?)").bind(crypto.randomUUID(), userId, deviceId, action, JSON.stringify(detail), createdAt).run();
  }

  async logs(deviceId: string): Promise<AuditLog[]> {
    const rows = await this.env.DB.prepare("SELECT id, device_id, user_id, action, request_json, created_at FROM audit_logs WHERE device_id = ? ORDER BY created_at DESC LIMIT 100").bind(deviceId).all<AuditRow>();
    return (rows.results ?? []).map(auditFromRow);
  }

  async saveBinding(deviceId: string, clientId: string, targetId: string): Promise<void> {
    const timestamp = now();
    await this.env.DB.prepare(sql.upsertDeviceBinding)
      .bind(crypto.randomUUID(), deviceId, clientId, targetId, timestamp, timestamp).run();
    await writeJson(this.env.HUB_KV, kvKeys.deviceBinding(deviceId), { clientId, targetId, state: "active", updatedAt: timestamp }, CACHE_TTL_SECONDS.binding);
  }

  async clearBinding(deviceId: string): Promise<void> {
    await this.env.DB.prepare(sql.closeDeviceBinding).bind(now(), deviceId).run();
    await this.env.HUB_KV.delete(kvKeys.deviceBinding(deviceId));
  }

  async cacheState(deviceId: string, state: unknown): Promise<void> {
    await writeJson(this.env.HUB_KV, kvKeys.deviceState(deviceId), state, CACHE_TTL_SECONDS.deviceState);
  }

  rateLimit(key: string, limit: number, ttl: number): Promise<boolean> {
    return incrementWindow(this.env.HUB_KV, kvKeys.rateLimit(key), limit, ttl);
    await this.env.DB.prepare("INSERT INTO device_bindings (id, device_id, client_id, target_id, state, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?) ON CONFLICT(device_id) DO UPDATE SET client_id = excluded.client_id, target_id = excluded.target_id, state = 'active', updated_at = excluded.updated_at").bind(crypto.randomUUID(), deviceId, clientId, targetId, timestamp, timestamp).run();
    await writeJson(this.env.HUB_KV, `device:binding:${deviceId}`, { clientId, targetId, state: "active", updatedAt: timestamp }, 300);
    await writeJson(this.env.CACHE_KV, `device:binding:${deviceId}`, { clientId, targetId, state: "active", updatedAt: timestamp }, 300);
  }

  async clearBinding(deviceId: string): Promise<void> {
    await this.env.DB.prepare("UPDATE device_bindings SET state = 'closed', updated_at = ? WHERE device_id = ?").bind(now(), deviceId).run();
    await this.env.HUB_KV.delete(`device:binding:${deviceId}`);
  }

  async cacheState(deviceId: string, state: unknown): Promise<void> { await writeJson(this.env.HUB_KV, `device:state:${deviceId}`, state, 120); }
  rateLimit(key: string, limit: number, ttl: number): Promise<boolean> { return incrementWindow(this.env.HUB_KV, `rl:${key}`, limit, ttl); }
    await this.env.CACHE_KV.delete(`device:binding:${deviceId}`);
  }

  }

  async saveBinding(deviceId: string, clientId: string, targetId: string): Promise<void> {
    const timestamp = now();
    await this.env.DB.prepare("INSERT INTO device_bindings (id, device_id, client_id, target_id, state, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?) ON CONFLICT(device_id) DO UPDATE SET client_id = excluded.client_id, target_id = excluded.target_id, state = 'active', updated_at = excluded.updated_at").bind(crypto.randomUUID(), deviceId, clientId, targetId, timestamp, timestamp).run();
    await writeJson(this.env.CACHE_KV, `device:binding:${deviceId}`, { clientId, targetId, state: "active", updatedAt: timestamp }, 300);
  }

  async clearBinding(deviceId: string): Promise<void> {
    await this.env.DB.prepare("UPDATE device_bindings SET state = 'closed', updated_at = ? WHERE device_id = ?").bind(now(), deviceId).run();
    await this.env.CACHE_KV.delete(`device:binding:${deviceId}`);
  }

  async cacheState(deviceId: string, state: unknown): Promise<void> { await writeJson(this.env.CACHE_KV, `device:state:${deviceId}`, state, 120); }
  rateLimit(key: string, limit: number, ttl: number): Promise<boolean> { return incrementWindow(this.env.RATE_LIMIT_KV, `rl:${key}`, limit, ttl); }
}
