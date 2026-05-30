import { clearCommand, strengthCommand, waveformCommand } from "./protocol";
import { bindDevice, deviceStatus, ownedDevice, sendDeviceCommand, unbindDevice } from "./device-service";
import { HttpError } from "./http";
import type { Store } from "./store";
import type { Env, Session } from "../types";

export const mcpTools = [
  { name: "list_devices", description: "List devices owned by the authenticated user" },
  { name: "get_device_status", description: "Get the real-time state for a device" },
  { name: "set_strength", description: "Decrease, increase, or set channel strength from 0 to 200" },
  { name: "send_waveform", description: "Send validated waveform pulses to channel A or B" },
  { name: "clear_channel", description: "Clear a device channel" },
  { name: "bind_device", description: "Bind clientId and targetId for control" },
  { name: "unbind_device", description: "Remove the current device binding" }
] as const;

export async function handleMcp(tool: string, args: Record<string, unknown>, store: Store, env: Env, session: Session): Promise<unknown> {
  if (tool === "list_devices") return { devices: await store.devices(session.userId) };
  const deviceId = typeof args.deviceId === "string" ? args.deviceId : "";
  if (!deviceId) throw new HttpError(400, "deviceId is required");
  await ownedDevice(store, session, deviceId);
  if (tool === "get_device_status") return deviceStatus(store, env, deviceId);
  if (tool === "set_strength") return sendDeviceCommand(store, env, session, deviceId, tool, strengthCommand(args.channel, args.mode, args.value));
  if (tool === "send_waveform") return sendDeviceCommand(store, env, session, deviceId, tool, waveformCommand(args.channel, args.pulses));
  if (tool === "clear_channel") return sendDeviceCommand(store, env, session, deviceId, tool, clearCommand(args.channel));
  if (tool === "bind_device") return bindDevice(store, env, session, deviceId, args, tool);
  if (tool === "unbind_device") return unbindDevice(store, env, session, deviceId, tool);
  throw new HttpError(404, "unknown MCP tool");
}
