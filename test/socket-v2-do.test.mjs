import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SocketV2DurableObject } from "../src/durable/socket-v2-do.ts";
import { socketEnvelope } from "../src/core/socket-v2.ts";

const socket = () => {
  const sent = [];
  return { sent, send: (value) => sent.push(JSON.parse(value)) };
};

const hub = () => new SocketV2DurableObject({}, { SOCKET_PULSE_INTERVAL_MS: "100" });

describe("DG-LAB SOCKET v2 hub safety", () => {
  it("rejects an APP that binds to a controller other than the QR-code controller", () => {
    const instance = hub(), appSocket = socket(), controllerSocket = socket();
    const controller = { id: "controller", role: "controller", socket: controllerSocket };
    const app = { id: "app", role: "app", socket: appSocket, requestedControllerId: controller.id };
    instance.peers.set(controller.id, controller);
    instance.peers.set(app.id, app);

    instance.bind(app, socketEnvelope("bind", "other-controller", app.id, "targetId"));

    assert.equal(app.partnerId, undefined);
    assert.deepEqual(appSocket.sent, [{ type: "error", clientId: "", targetId: "app", message: "401" }]);
  });

  it("replaces same-channel pulse timers and cancels them when the controller disconnects", () => {
    const instance = hub(), appSocket = socket(), controllerSocket = socket();
    const controller = { id: "controller", role: "controller", socket: controllerSocket, partnerId: "app" };
    const app = { id: "app", role: "app", socket: appSocket, partnerId: "controller", requestedControllerId: controller.id };
    const pulse = socketEnvelope("msg", controller.id, app.id, 'pulse-A:["0A0A0A0A64646464"]');
    instance.peers.set(controller.id, controller);
    instance.peers.set(app.id, app);

    instance.repeatPulse(controller, app, pulse, 5);
    assert.equal(instance.pulseTimers.size, 1);
    instance.repeatPulse(controller, app, pulse, 5);
    assert.equal(instance.pulseTimers.size, 1);
    assert.equal(appSocket.sent.length, 2);

    instance.onMessage(controller, JSON.stringify({ type: 4, clientId: controller.id, targetId: app.id, message: "clear-1" }));
    assert.equal(instance.pulseTimers.size, 0);
    assert.equal(appSocket.sent.at(-1).message, "clear-1");

    instance.repeatPulse(controller, app, pulse, 5);
    assert.equal(instance.pulseTimers.size, 1);
    instance.close(controller);
    assert.equal(instance.pulseTimers.size, 0);
    assert.equal(app.partnerId, undefined);
    assert.equal(appSocket.sent.at(-1).type, "break");
  });
});
