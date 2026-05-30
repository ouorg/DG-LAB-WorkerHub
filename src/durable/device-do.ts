import { assertMessageLength, parseAppReport, ProtocolError } from "../core/protocol";
import type { DeviceState, Env } from "../types";

interface StoredState extends DeviceState { queued: string[]; recentCommands: number[] }

const initialState = (): StoredState => ({ online: false, strengths: { A: 0, B: 0 }, queueDepth: 0, queued: [], recentCommands: [] });
const json = (value: unknown, status = 200) => Response.json(value, { status });

export class DeviceDurableObject implements DurableObject {
  private state: StoredState = initialState();
  private sockets = new Set<WebSocket>();
  private ready: Promise<void>;

  constructor(private readonly ctx: DurableObjectState, _env: Env) {
    this.ready = ctx.blockConcurrencyWhile(async () => { this.state = (await ctx.storage.get<StoredState>("state")) ?? initialState(); });
  }

  private async save() { this.state.queueDepth = this.state.queued.length; await this.ctx.storage.put("state", this.state); }
  private publicState(): DeviceState {
    const { online, strengths, clientId, targetId, lastHeartbeat, lastFeedback, queueDepth, controlPermission } = this.state;
    return { online, strengths, clientId, targetId, lastHeartbeat, lastFeedback, queueDepth, controlPermission };
  }

  private async onMessage(message: string, socket: WebSocket) {
    try { assertMessageLength(message); } catch (error) {
      socket.close(1008, error instanceof Error ? error.message : "invalid message");
      return;
    }
    if (message === "heartbeat" || message === "ping") {
      this.state.lastHeartbeat = new Date().toISOString();
      this.state.online = true;
      await this.save();
      return;
    }
    try {
      const report = parseAppReport(message);
      if (!report) { socket.close(1008, "unsupported APP message"); return; }
      this.state.lastFeedback = report.raw;
      if (report.type === "strength") this.state.strengths[report.channel === 1 ? "A" : "B"] = report.value;
      await this.save();
    } catch (error) {
      if (!(error instanceof ProtocolError)) throw error;
      socket.close(1008, error.message);
    }
  }

  private attach(server: WebSocket) {
    server.accept();
    this.sockets.add(server);
    this.state.online = true;
    this.state.lastHeartbeat = new Date().toISOString();
    server.addEventListener("message", (event) => { if (typeof event.data === "string") void this.onMessage(event.data, server); });
    const close = () => { this.sockets.delete(server); this.state.online = this.sockets.size > 0; void this.save(); };
    server.addEventListener("close", close);
    server.addEventListener("error", close);
    for (const command of this.state.queued) server.send(command);
    this.state.queued = [];
    void this.save();
  }

  private enforceRateLimit() {
    const cutoff = Date.now() - 10_000;
    this.state.recentCommands = this.state.recentCommands.filter((time) => time > cutoff);
    if (this.state.recentCommands.length >= 20) throw new ProtocolError("command rate limit exceeded");
    this.state.recentCommands.push(Date.now());
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/status") return json(this.publicState());
    if (request.method === "GET" && url.pathname === "/connect" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      this.attach(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (url.pathname === "/bind") {
      const body = await request.json() as { clientId?: string; targetId?: string };
      if (!body.clientId || !body.targetId) return json({ error: "clientId and targetId are required" }, 400);
      this.state.clientId = body.clientId;
      this.state.targetId = body.targetId;
      this.state.controlPermission = body.clientId;
      await this.save();
      return json(this.publicState());
    }
    if (url.pathname === "/unbind") {
      delete this.state.clientId; delete this.state.targetId; delete this.state.controlPermission;
      await this.save();
      return json(this.publicState());
    }
    if (url.pathname === "/command") {
      try {
        if (!this.state.clientId || !this.state.targetId) throw new ProtocolError("device must be bound before sending commands");
        const { command } = await request.json() as { command?: unknown };
        if (typeof command !== "string") throw new ProtocolError("command must be a string");
        assertMessageLength(command);
        this.enforceRateLimit();
        if (this.sockets.size) for (const socket of this.sockets) socket.send(command);
        else {
          if (this.state.queued.length >= 100) throw new ProtocolError("offline command queue is full");
          this.state.queued.push(command);
        }
        await this.save();
        return json({ accepted: true, queued: !this.sockets.size, command });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "invalid command" }, 400);
      }
    }
    return json({ error: "not_found" }, 404);
  }
}
