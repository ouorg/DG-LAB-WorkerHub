import { Store } from "./core/store";
import { clearCommand, ProtocolError, strengthCommand, waveformCommand } from "./core/protocol";
import { DeviceDurableObject } from "./durable/device-do";
import { SocketV2DurableObject } from "./durable/socket-v2-do";
import type { Device, Env, Session } from "./types";
import { consoleHtml } from "./ui/console";

export { DeviceDurableObject, SocketV2DurableObject };
class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
const reply = (value: unknown, status = 200) => Response.json(value, { status });
const text = (value: string, contentType: string) => new Response(value, { headers: { "content-type": contentType } });
async function matchesPassword(input: unknown, expected: string | undefined): Promise<boolean> {
  if (typeof input !== "string" || !input || !expected) return false;
  const encode = (value: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [actualHash, expectedHash] = await Promise.all([encode(input), encode(expected)]);
  const actual = new Uint8Array(actualHash), wanted = new Uint8Array(expectedHash);
  let mismatch = actual.length ^ wanted.length;
  for (let index = 0; index < actual.length; index++) mismatch |= actual[index] ^ wanted[index];
  return mismatch === 0;
}
async function body<T>(request: Request): Promise<T> { try { return await request.json() as T; } catch { throw new HttpError(400, "request body must be valid JSON"); } }
function doStub(env: Env, deviceId: string) { return env.DEVICE_DO.get(env.DEVICE_DO.idFromName(deviceId)); }
async function doJson(stub: DurableObjectStub, path: string, method = "GET", payload?: unknown) {
  const response = await stub.fetch(`https://device.internal${path}`, { method, body: payload === undefined ? undefined : JSON.stringify(payload), headers: { "content-type": "application/json" } });
  const result = await response.json() as unknown;
  if (!response.ok) throw new HttpError(response.status, (result as { error?: string }).error ?? "device session error");
  return result;
}
async function requireSession(request: Request, store: Store): Promise<Session> {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) throw new HttpError(401, "authentication required");
  const session = await store.session(value.slice(7));
  if (!session) throw new HttpError(401, "session is missing or expired");
  return session;
}
async function ownedDevice(store: Store, session: Session, id: string): Promise<Device> {
  const device = await store.device(id);
  if (!device) throw new HttpError(404, "device not found");
  if (device.ownerId !== session.userId) throw new HttpError(403, "device ownership check failed");
  return device;
}
function requireName(value: unknown): string {
  if (typeof value !== "string" || !/^[\p{L}\p{N} _.-]{1,64}$/u.test(value)) throw new HttpError(400, "name must contain 1 to 64 safe characters");
  return value;
}

async function control(store: Store, env: Env, session: Session, deviceId: string, action: string, command: string) {
  await ownedDevice(store, session, deviceId);
  try {
    const result = await doJson(doStub(env, deviceId), "/command", "POST", { command });
    await store.audit(session.userId, deviceId, action, { command, result });
    return result;
  } catch (error) {
    await store.audit(session.userId, deviceId, `${action}_rejected`, { command, error: error instanceof Error ? error.message : "unknown error" });
    throw error;
  }
}

const mcpTools = [
  { name: "list_devices", description: "List devices owned by the authenticated user" },
  { name: "get_device_status", description: "Get the real-time state for a device" },
  { name: "set_strength", description: "Decrease, increase, or set channel strength from 0 to 200" },
  { name: "send_waveform", description: "Send validated waveform pulses to channel A or B" },
  { name: "clear_channel", description: "Clear a device channel" },
  { name: "bind_device", description: "Bind clientId and targetId for control" },
  { name: "unbind_device", description: "Remove the current device binding" }
];

async function handleMcp(tool: string, args: Record<string, unknown>, store: Store, env: Env, session: Session) {
  if (tool === "list_devices") return { devices: await store.devices(session.userId) };
  const deviceId = typeof args.deviceId === "string" ? args.deviceId : "";
  if (!deviceId) throw new HttpError(400, "deviceId is required");
  await ownedDevice(store, session, deviceId);
  if (tool === "get_device_status") return doJson(doStub(env, deviceId), "/status");
  if (tool === "set_strength") return control(store, env, session, deviceId, tool, strengthCommand(args.channel, args.mode, args.value));
  if (tool === "send_waveform") return control(store, env, session, deviceId, tool, waveformCommand(args.channel, args.pulses));
  if (tool === "clear_channel") return control(store, env, session, deviceId, tool, clearCommand(args.channel));
  if (tool === "bind_device" || tool === "unbind_device") {
    const path = tool === "bind_device" ? "/bind" : "/unbind";
    const result = await doJson(doStub(env, deviceId), path, "POST", args);
    await store.audit(session.userId, deviceId, tool, args);
    return result;
  }
  throw new HttpError(404, "unknown MCP tool");
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url), path = url.pathname, store = new Store(env);
  if (request.method === "GET" && path === "/") return text(consoleHtml, "text/html; charset=utf-8");
  if (request.method === "GET" && path === "/api/health") return reply({ ok: true, service: "dg-lab-worker-hub" });
  const socketApp = /^\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.exec(path);
  if (request.method === "GET" && request.headers.get("upgrade")?.toLowerCase() === "websocket" && (path === "/socket" || socketApp)) {
    const stub = env.SOCKET_V2_DO.get(env.SOCKET_V2_DO.idFromName("socket-v2-hub"));
    const internal = new URL("https://socket.internal/connect");
    if (socketApp) internal.searchParams.set("clientId", socketApp[1]);
    return stub.fetch(new Request(internal, request));
  }
  if (request.method === "POST" && path === "/api/auth/login") {
    const input = await body<{ password?: unknown }>(request);
    if (!await matchesPassword(input.password, env.LOGIN_PASSWORD)) throw new HttpError(401, "invalid password");
    const session = await store.createSession();
    const { device, created } = await store.defaultDevice(session.userId);
    if (created) await store.audit(session.userId, device.id, "create_default_device", { name: device.name });
    return reply({ session, device }, 201);
  }
  const connect = /^\/api\/devices\/([^/]+)\/connect$/.exec(path);
  if (request.method === "GET" && connect && request.headers.get("upgrade")?.toLowerCase() === "websocket") {
    const device = await store.device(connect[1]);
    if (!device || url.searchParams.get("token") !== device.appToken) throw new HttpError(401, "invalid device token");
    return doStub(env, device.id).fetch(new Request("https://device.internal/connect", request));
  }
  const session = await requireSession(request, store);
  if (request.method === "GET" && path === "/api/devices") return reply({ devices: await store.devices(session.userId) });
  if (request.method === "POST" && path === "/api/devices") {
    const input = await body<{ name?: unknown }>(request);
    const device = await store.createDevice(session.userId, requireName(input.name));
    await store.audit(session.userId, device.id, "create_device", { name: device.name });
    return reply({ device }, 201);
  }
  if (request.method === "GET" && path === "/api/mcp/tools") return reply({ tools: mcpTools });
  const mcp = /^\/api\/mcp\/tool\/([^/]+)$/.exec(path);
  if (request.method === "POST" && mcp) return reply(await handleMcp(mcp[1], await body<Record<string, unknown>>(request), store, env, session));
  const match = /^\/api\/devices\/([^/]+)\/(status|logs|bind|unbind|strength|waveform|clear)$/.exec(path);
  if (match) {
    const [, deviceId, action] = match;
    await ownedDevice(store, session, deviceId);
    if (request.method === "GET" && action === "status") return reply(await doJson(doStub(env, deviceId), "/status"));
    if (request.method === "GET" && action === "logs") return reply({ logs: await store.logs(deviceId) });
    if (request.method === "POST") {
      const args = action === "unbind" ? {} : await body<Record<string, unknown>>(request);
      if (action === "bind" || action === "unbind") {
        const result = await doJson(doStub(env, deviceId), `/${action}`, "POST", args);
        await store.audit(session.userId, deviceId, action, args);
        return reply(result);
      }
      if (action === "strength") return reply(await control(store, env, session, deviceId, action, strengthCommand(args.channel, args.mode, args.value)));
      if (action === "waveform") return reply(await control(store, env, session, deviceId, action, waveformCommand(args.channel, args.pulses)));
      if (action === "clear") return reply(await control(store, env, session, deviceId, action, clearCommand(args.channel)));
    }
  }
  throw new HttpError(404, "not found");
}

export default { async fetch(request: Request, env: Env) { try { return await route(request, env); } catch (error) {
  if (error instanceof ProtocolError) return reply({ error: error.message }, 400);
  if (error instanceof HttpError) return reply({ error: error.message }, error.status);
  console.error(error); return reply({ error: "internal server error" }, 500);
} } } satisfies ExportedHandler<Env>;
