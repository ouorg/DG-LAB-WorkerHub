import { assertMessageLength, parseChannel, ProtocolError, strengthCommand, waveformCommand } from "./protocol.ts";

export type SocketChannel = "A" | "B";

export interface SocketEnvelope {
  type: string | number;
  clientId: string;
  targetId: string;
  message: string;
  channel?: unknown;
  strength?: unknown;
  time?: unknown;
}

export const socketEnvelope = (type: string | number, clientId: string, targetId: string, message: string): SocketEnvelope => ({
  type, clientId, targetId, message,
});

export function parseSocketEnvelope(raw: string): SocketEnvelope {
  if (raw.length > 1950) throw new ProtocolError("405");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new ProtocolError("403"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProtocolError("403");
  const input = value as Record<string, unknown>;
  if ((typeof input.type !== "string" && typeof input.type !== "number") || typeof input.clientId !== "string" || typeof input.targetId !== "string" || typeof input.message !== "string") {
    throw new ProtocolError("403");
  }
  return input as unknown as SocketEnvelope;
}

export function controllerCommand(input: SocketEnvelope): string {
  if (input.type === 1 || input.type === 2) return strengthCommand(input.channel, input.type - 1, 1);
  if (input.type === 3) return strengthCommand(input.channel, 2, input.strength);
  if (input.type === 4) return assertMessageLength(input.message);
  if (input.type === "clientMsg") {
    if (input.channel === undefined) throw new ProtocolError("406");
    const channel = parseChannel(input.channel) === 1 ? "A" : "B";
    const separator = input.message.indexOf(":");
    if (separator < 0 || input.message.slice(0, separator).toUpperCase() !== channel) throw new ProtocolError("waveform message channel does not match channel");
    let pulses: unknown;
    try { pulses = JSON.parse(input.message.slice(separator + 1)); } catch { throw new ProtocolError("waveform pulses must be JSON"); }
    return waveformCommand(channel, pulses);
  }
  throw new ProtocolError("unsupported controller message type");
}

export function pulseCommandChannel(command: string): SocketChannel | undefined {
  return /^pulse-([AB]):/.exec(command)?.[1] as SocketChannel | undefined;
}

export function clearedPulseChannel(command: string): SocketChannel | undefined {
  const channel = /^clear-([12])$/.exec(command)?.[1];
  return channel === "1" ? "A" : channel === "2" ? "B" : undefined;
}

export function punishmentDuration(value: unknown, fallback = 5): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 60) throw new ProtocolError("time must be an integer between 1 and 60");
  return value;
}
