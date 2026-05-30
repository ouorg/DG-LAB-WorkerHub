import type { AuditLog, Device, Env, Session, User } from "../types";

const json = <T>(value: T) => JSON.stringify(value);
const now = () => new Date().toISOString();

export class Store {
  constructor(private readonly env: Env) {}
  async get<T>(key: string): Promise<T | null> { return this.env.HUB_KV.get<T>(key, "json"); }
  async put<T>(key: string, value: T, options?: KVNamespacePutOptions): Promise<void> { await this.env.HUB_KV.put(key, json(value), options); }

  async createSession(): Promise<Session> {
    const user: User = { id: "bootstrap", name: "Administrator", createdAt: now() };
    await this.put(`user:${user.id}`, user);
    const ttl = Math.max(300, Number(this.env.SESSION_TTL_SECONDS ?? 86400));
    const session: Session = { id: crypto.randomUUID(), userId: user.id, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
    await this.put(`session:${session.id}`, session, { expirationTtl: ttl });
    return session;
  }

  async session(id: string): Promise<Session | null> {
    const session = await this.get<Session>(`session:${id}`);
    return session && Date.parse(session.expiresAt) > Date.now() ? session : null;
  }

  async createDevice(ownerId: string, name: string): Promise<Device> {
    const device: Device = { id: crypto.randomUUID(), ownerId, name, appToken: crypto.randomUUID(), createdAt: now() };
    await this.put(`device:${device.id}`, device);
    await this.put(`owner:${ownerId}:device:${device.id}`, device.id);
    return device;
  }

  device(id: string) { return this.get<Device>(`device:${id}`); }

  async devices(ownerId: string): Promise<Device[]> {
    const keys = await this.env.HUB_KV.list({ prefix: `owner:${ownerId}:device:` });
    return (await Promise.all(keys.keys.map(({ name }) => this.device(name.slice(name.lastIndexOf(":") + 1))))).filter(Boolean) as Device[];
  }

  async audit(userId: string, deviceId: string, action: string, detail: unknown): Promise<void> {
    const log: AuditLog = { id: crypto.randomUUID(), userId, deviceId, action, detail, createdAt: now() };
    await this.put(`audit:${deviceId}:${log.createdAt}:${log.id}`, log, { expirationTtl: 60 * 60 * 24 * 30 });
  }

  async logs(deviceId: string): Promise<AuditLog[]> {
    const keys = await this.env.HUB_KV.list({ prefix: `audit:${deviceId}:`, limit: 100 });
    const logs = await Promise.all(keys.keys.map(({ name }) => this.get<AuditLog>(name)));
    return logs.filter(Boolean).reverse() as AuditLog[];
  }
}
