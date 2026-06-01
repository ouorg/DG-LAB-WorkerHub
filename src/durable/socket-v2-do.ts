import { MAX_MESSAGE_LENGTH, ProtocolError } from "../core/protocol.ts";
import { clearedPulseChannel, controllerCommand, parseSocketEnvelope, pulseCommandChannel, punishmentDuration, socketEnvelope, type SocketChannel, type SocketEnvelope } from "../core/socket-v2.ts";
import type { Env } from "../types";

type Role = "controller" | "app";
interface Peer { id: string; role: Role; socket: WebSocket; partnerId?: string; requestedControllerId?: string }

const encode = (value: SocketEnvelope) => JSON.stringify(value);

export class SocketV2DurableObject implements DurableObject {
  private readonly peers = new Map<string, Peer>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly pulseTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly env: Env;

  constructor(_ctx: DurableObjectState, env: Env) { this.env = env; }

  private send(peer: Peer | undefined, value: SocketEnvelope) { if (peer) peer.socket.send(encode(value)); }
  private error(peer: Peer, code: string) { this.send(peer, socketEnvelope("error", peer.role === "controller" ? peer.id : peer.partnerId ?? "", peer.role === "app" ? peer.id : peer.partnerId ?? "", code)); }
  private partner(peer: Peer) { return peer.partnerId ? this.peers.get(peer.partnerId) : undefined; }
  private ids(peer: Peer) {
    const partner = this.partner(peer);
    return { clientId: peer.role === "controller" ? peer.id : partner?.id ?? "", targetId: peer.role === "app" ? peer.id : partner?.id ?? "" };
  }
  private heartbeat(peer: Peer) {
    const interval = Math.max(1000, Number(this.env.HEARTBEAT_INTERVAL) || 60_000);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.peers.has(peer.id)) return;
      const { clientId, targetId } = this.ids(peer);
      this.send(peer, socketEnvelope("heartbeat", clientId, targetId, "200"));
      this.heartbeat(peer);
    }, interval);
    this.timers.add(timer);
  }

  private bind(app: Peer, input: SocketEnvelope) {
    if (app.requestedControllerId !== input.clientId) return this.error(app, "401");
    const controller = this.peers.get(input.clientId);
    if (!controller || controller.role !== "controller") return this.error(app, "401");
    if (input.targetId !== app.id) return this.error(app, "402");
    if (controller.partnerId && controller.partnerId !== app.id) return this.send(app, socketEnvelope("bind", controller.id, app.id, "400"));
    if (app.partnerId && app.partnerId !== controller.id) return this.send(app, socketEnvelope("bind", controller.id, app.id, "400"));
    controller.partnerId = app.id;
    app.partnerId = controller.id;
    const success = socketEnvelope("bind", controller.id, app.id, "200");
    this.send(controller, success);
    this.send(app, success);
  }

  private validatePair(sender: Peer, input: SocketEnvelope): Peer | undefined {
    const recipient = this.partner(sender);
    const clientId = sender.role === "controller" ? sender.id : recipient?.id;
    const targetId = sender.role === "app" ? sender.id : recipient?.id;
    if (!recipient || input.clientId !== clientId || input.targetId !== targetId) { this.error(sender, "402"); return undefined; }
    return recipient;
  }

  private pulseTimerKey(appId: string, channel: SocketChannel) { return `${appId}:${channel}`; }
  private stopPulse(appId: string, channel: SocketChannel) {
    const key = this.pulseTimerKey(appId, channel), timer = this.pulseTimers.get(key);
    if (!timer) return;
    clearTimeout(timer);
    this.timers.delete(timer);
    this.pulseTimers.delete(key);
  }
  private stopPulses(appId: string) { this.stopPulse(appId, "A"); this.stopPulse(appId, "B"); }

  private repeatPulse(controller: Peer, app: Peer, message: SocketEnvelope, seconds: number) {
    const channel = pulseCommandChannel(message.message);
    if (!channel) return this.error(controller, "500");
    this.stopPulse(app.id, channel);
    const interval = Math.max(100, Number(this.env.SOCKET_PULSE_INTERVAL_MS) || 1000);
    const stopAt = Date.now() + seconds * 1000, key = this.pulseTimerKey(app.id, channel);
    const send = () => {
      if (this.peers.get(app.id) !== app || app.partnerId !== controller.id || controller.partnerId !== app.id || Date.now() >= stopAt) return;
      this.send(app, message);
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        if (this.pulseTimers.get(key) === timer) this.pulseTimers.delete(key);
        send();
      }, interval);
      this.timers.add(timer);
      this.pulseTimers.set(key, timer);
    };
    send();
  }

  private onMessage(peer: Peer, raw: string) {
    let input: SocketEnvelope;
    try { input = parseSocketEnvelope(raw); } catch (error) { return this.error(peer, error instanceof ProtocolError ? error.message : "403"); }
    if (peer.role === "app" && input.type === "bind") return this.bind(peer, input);
    const recipient = this.validatePair(peer, input);
    if (!recipient) return;
    if (peer.role === "app") return this.send(recipient, input);
    try {
      const command = controllerCommand(input);
      const output = socketEnvelope("msg", peer.id, recipient.id, command);
      if (encode(output).length > MAX_MESSAGE_LENGTH) return this.error(peer, "405");
      if (input.type === "clientMsg") this.repeatPulse(peer, recipient, output, punishmentDuration(input.time));
      else {
        const clearedChannel = clearedPulseChannel(command);
        if (clearedChannel) this.stopPulse(recipient.id, clearedChannel);
        this.send(recipient, output);
      }
    } catch (error) { this.error(peer, error instanceof ProtocolError ? error.message : "500"); }
  }

  private close(peer: Peer) {
    const partner = this.partner(peer);
    const app = peer.role === "app" ? peer : partner?.role === "app" ? partner : undefined;
    if (app) this.stopPulses(app.id);
    if (!this.peers.delete(peer.id) || !partner) return;
    delete partner.partnerId;
    this.send(partner, socketEnvelope("break", partner.role === "controller" ? partner.id : peer.id, partner.role === "app" ? partner.id : peer.id, "209"));
  }

  private attach(server: WebSocket, clientId?: string) {
    server.accept();
    const role: Role = clientId ? "app" : "controller";
    const peer: Peer = { id: crypto.randomUUID(), role, socket: server, requestedControllerId: clientId };
    this.peers.set(peer.id, peer);
    this.heartbeat(peer);
    if (role === "controller") this.send(peer, socketEnvelope("bind", peer.id, "", "targetId"));
    else this.send(peer, socketEnvelope("bind", clientId ?? "", peer.id, "targetId"));
    server.addEventListener("message", (event) => { if (typeof event.data === "string") this.onMessage(peer, event.data); else this.error(peer, "403"); });
    server.addEventListener("close", () => this.close(peer));
    server.addEventListener("error", () => this.close(peer));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "GET" || request.headers.get("upgrade")?.toLowerCase() !== "websocket") return Response.json({ error: "websocket_upgrade_required" }, { status: 426 });
    const pair = new WebSocketPair();
    this.attach(pair[1], url.searchParams.get("clientId") || undefined);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
}
