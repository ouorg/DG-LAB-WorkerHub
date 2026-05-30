import { matchesPassword, enforceLoginRateLimit, requireSession } from "./core/auth";
import { bindDevice, deviceStatus, deviceStub, ownedDevice, sendDeviceCommand, unbindDevice } from "./core/device-service";
import { html, HttpError, json, jsonBody } from "./core/http";
import { handleMcp, mcpTools } from "./core/mcp";
import { clearCommand, ProtocolError, strengthCommand, waveformCommand } from "./core/protocol";
import { Store } from "./core/store";
import { DeviceDurableObject } from "./durable/device-do";
import { SocketV2DurableObject } from "./durable/socket-v2-do";
import type { Env } from "./types";
import { consoleHtml } from "./ui/console";

export { DeviceDurableObject, SocketV2DurableObject };

const socketAppPath = /^\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const deviceConnectPath = /^\/api\/devices\/([^/]+)\/connect$/;
const deviceActionPath = /^\/api\/devices\/([^/]+)\/(status|logs|bind|unbind|strength|waveform|clear)$/;
const mcpToolPath = /^\/api\/mcp\/tool\/([^/]+)$/;
const isWebSocketUpgrade = (request: Request) => request.headers.get("upgrade")?.toLowerCase() === "websocket";

async function socketV2Upgrade(request: Request, env: Env, appClientId?: string): Promise<Response> {
  const stub = env.SOCKET_V2_DO.get(env.SOCKET_V2_DO.idFromName("socket-v2-hub"));
  const internal = new URL("https://socket.internal/connect");
  if (appClientId) internal.searchParams.set("clientId", appClientId);
  return stub.fetch(new Request(internal, request));
}

async function login(request: Request, env: Env, store: Store): Promise<Response> {
  await enforceLoginRateLimit(request, store);
  const input = await jsonBody<{ password?: unknown }>(request);
  if (!await matchesPassword(input.password, env.LOGIN_PASSWORD)) throw new HttpError(401, "invalid password");
  const session = await store.createSession();
  const { device, created } = await store.defaultDevice(session.userId);
  if (created) await store.audit(session.userId, device.id, "create_default_device", { name: device.name });
  return json({ session, device }, 201);
}

async function deviceAppUpgrade(request: Request, env: Env, store: Store, deviceId: string, token: string | null): Promise<Response> {
  const device = await store.device(deviceId);
  if (!device || token !== device.appToken) throw new HttpError(401, "invalid device token");
  return deviceStub(env, device.id).fetch(new Request("https://device.internal/connect", request));
}

function requireName(value: unknown): string {
  if (typeof value !== "string" || !/^[\p{L}\p{N} _.-]{1,64}$/u.test(value)) throw new HttpError(400, "name must contain 1 to 64 safe characters");
  return value;
}

async function deviceAction(request: Request, env: Env, store: Store, deviceId: string, action: string): Promise<Response> {
  const session = await requireSession(request, store);
  await ownedDevice(store, session, deviceId);
  if (request.method === "GET" && action === "status") return json(await deviceStatus(store, env, deviceId));
  if (request.method === "GET" && action === "logs") return json({ logs: await store.logs(deviceId) });
  if (request.method !== "POST") throw new HttpError(405, "method not allowed");
  if (action === "unbind") return json(await unbindDevice(store, env, session, deviceId));
  const args = await jsonBody<Record<string, unknown>>(request);
  if (action === "bind") return json(await bindDevice(store, env, session, deviceId, args));
  if (action === "strength") return json(await sendDeviceCommand(store, env, session, deviceId, action, strengthCommand(args.channel, args.mode, args.value)));
  if (action === "waveform") return json(await sendDeviceCommand(store, env, session, deviceId, action, waveformCommand(args.channel, args.pulses)));
  if (action === "clear") return json(await sendDeviceCommand(store, env, session, deviceId, action, clearCommand(args.channel)));
  throw new HttpError(404, "not found");
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url), path = url.pathname, store = new Store(env);
  if (request.method === "GET" && path === "/") return html(consoleHtml);
  if (request.method === "GET" && path === "/api/health") { await store.bootstrap(); return json({ ok: true, service: "dg-lab-worker-hub", storage: "d1+kv+r2+do" }); }
  const socketApp = socketAppPath.exec(path);
  if (request.method === "GET" && isWebSocketUpgrade(request) && (path === "/socket" || socketApp)) return socketV2Upgrade(request, env, socketApp?.[1]);
  if (request.method === "POST" && path === "/api/auth/login") return login(request, env, store);
  const connect = deviceConnectPath.exec(path);
  if (request.method === "GET" && isWebSocketUpgrade(request) && connect) return deviceAppUpgrade(request, env, store, connect[1], url.searchParams.get("token"));
  const match = deviceActionPath.exec(path);
  if (match) return deviceAction(request, env, store, match[1], match[2]);
  const session = await requireSession(request, store);
  if (request.method === "GET" && path === "/api/devices") return json({ devices: await store.devices(session.userId) });
  if (request.method === "POST" && path === "/api/devices") {
    const input = await jsonBody<{ name?: unknown }>(request);
    const device = await store.createDevice(session.userId, requireName(input.name));
    await store.audit(session.userId, device.id, "create_device", { name: device.name });
    return json({ device }, 201);
  }
  if (request.method === "GET" && path === "/api/mcp/tools") return json({ tools: mcpTools });
  const mcp = mcpToolPath.exec(path);
  if (request.method === "POST" && mcp) return json(await handleMcp(mcp[1], await jsonBody<Record<string, unknown>>(request), store, env, session));
  throw new HttpError(404, "not found");
}

export default {
  async fetch(request: Request, env: Env) {
    try { return await route(request, env); }
    catch (error) {
      if (error instanceof ProtocolError) return json({ error: error.message }, 400);
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error(error);
      return json({ error: "internal server error" }, 500);
    }
  }
} satisfies ExportedHandler<Env>;
