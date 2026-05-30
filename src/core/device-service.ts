import { HttpError } from "./http";
import type { Store } from "./store";
import type { Device, Env, Session } from "../types";

export function deviceStub(env: Env, deviceId: string): DurableObjectStub {
  return env.DEVICE_DO.get(env.DEVICE_DO.idFromName(deviceId));
}

export async function deviceJson(stub: DurableObjectStub, path: string, method = "GET", payload?: unknown): Promise<unknown> {
  const response = await stub.fetch(`https://device.internal${path}`, {
    method,
    body: payload === undefined ? undefined : JSON.stringify(payload),
    headers: { "content-type": "application/json" }
  });
  const result = await response.json() as unknown;
  if (!response.ok) throw new HttpError(response.status, (result as { error?: string }).error ?? "device session error");
  return result;
}

export async function ownedDevice(store: Store, session: Session, id: string): Promise<Device> {
  const device = await store.device(id);
  if (!device) throw new HttpError(404, "device not found");
  if (device.ownerId !== session.userId) throw new HttpError(403, "device ownership check failed");
  return device;
}

export async function deviceStatus(store: Store, env: Env, deviceId: string): Promise<unknown> {
  const state = await deviceJson(deviceStub(env, deviceId), "/status");
  await store.cacheState(deviceId, state);
  return state;
}

export async function bindDevice(store: Store, env: Env, session: Session, deviceId: string, args: Record<string, unknown>, auditAction = "bind"): Promise<unknown> {
  const result = await deviceJson(deviceStub(env, deviceId), "/bind", "POST", args);
  await store.saveBinding(deviceId, String(args.clientId), String(args.targetId));
  await store.audit(session.userId, deviceId, auditAction, args);
  await store.cacheState(deviceId, result);
  return result;
}

export async function unbindDevice(store: Store, env: Env, session: Session, deviceId: string, auditAction = "unbind"): Promise<unknown> {
  const result = await deviceJson(deviceStub(env, deviceId), "/unbind", "POST", {});
  await store.clearBinding(deviceId);
  await store.audit(session.userId, deviceId, auditAction, {});
  await store.cacheState(deviceId, result);
  return result;
}

export async function sendDeviceCommand(store: Store, env: Env, session: Session, deviceId: string, action: string, command: string): Promise<unknown> {
  await ownedDevice(store, session, deviceId);
  try {
    const result = await deviceJson(deviceStub(env, deviceId), "/command", "POST", { command });
    await store.audit(session.userId, deviceId, action, { command, result });
    await store.cacheState(deviceId, result);
    return result;
  } catch (error) {
    await store.audit(session.userId, deviceId, `${action}_rejected`, { command, error: error instanceof Error ? error.message : "unknown error" });
    throw error;
  }
}
