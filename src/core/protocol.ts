export type Channel = 1 | 2;
export type StrengthMode = 0 | 1 | 2;
export const MAX_MESSAGE_LENGTH = 1950;

export class ProtocolError extends Error {}

export function parseChannel(value: unknown): Channel {
  if (value === 1 || value === "1" || value === "A" || value === "a") return 1;
  if (value === 2 || value === "2" || value === "B" || value === "b") return 2;
  throw new ProtocolError("channel must be 1/A or 2/B");
}

function integerInRange(value: unknown, min: number, max: number, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ProtocolError(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export function strengthCommand(channelValue: unknown, modeValue: unknown, value: unknown): string {
  const channel = parseChannel(channelValue);
  const mode = integerInRange(modeValue, 0, 2, "mode") as StrengthMode;
  const strength = integerInRange(value, 0, 200, "value");
  return `strength-${channel}+${mode}+${strength}`;
}

export function waveformCommand(channelValue: unknown, pulses: unknown): string {
  const channel = parseChannel(channelValue) === 1 ? "A" : "B";
  if (!Array.isArray(pulses) || pulses.length === 0) throw new ProtocolError("pulses must be a non-empty array");
  if (pulses.length > 100) throw new ProtocolError("pulses must contain at most 100 entries");
  for (const pulse of pulses) {
    if (typeof pulse !== "string" || !/^[0-9a-fA-F]{16}$/.test(pulse)) {
      throw new ProtocolError("each pulse must be a 16-character hexadecimal string");
    }
  }
  return assertMessageLength(`pulse-${channel}:${JSON.stringify(pulses)}`);
}

export function clearCommand(channelValue: unknown): string {
  return `clear-${parseChannel(channelValue)}`;
}

export function assertMessageLength(message: string): string {
  if (message.length > MAX_MESSAGE_LENGTH) throw new ProtocolError(`message exceeds ${MAX_MESSAGE_LENGTH} characters`);
  return message;
}

export type AppReport =
  | { type: "strength"; channel: Channel; value: number; raw: string }
  | { type: "feedback"; value: string; raw: string };

export function parseAppReport(message: string): AppReport | undefined {
  const strength = /^strength-([12ABab])(?:\+\d)?\+(\d{1,3})$/.exec(message);
  if (strength) {
    const value = Number(strength[2]);
    if (value > 200) throw new ProtocolError("reported strength exceeds 200");
    return { type: "strength", channel: parseChannel(strength[1]), value, raw: message };
  }
  const feedback = /^feedback-(.{1,512})$/.exec(message);
  if (feedback) return { type: "feedback", value: feedback[1], raw: message };
  return undefined;
}
