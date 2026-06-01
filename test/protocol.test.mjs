import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertMessageLength, clearCommand, MAX_MESSAGE_LENGTH, parseAppReport, strengthCommand, waveformCommand } from "../src/core/protocol.ts";

describe("DG-LAB protocol adapter", () => {
  it("maps strength channels, modes, and protected values", () => {
    assert.equal(strengthCommand("A", 2, 200), "strength-1+2+200");
    assert.equal(strengthCommand(2, 0, 10), "strength-2+0+10");
    assert.throws(() => strengthCommand(1, 2, 201), /between 0 and 200/);
  });
  it("maps waveform and clear commands", () => {
    assert.equal(waveformCommand(1, ["0A0A0A0A0A0A0A0A"]), 'pulse-A:["0A0A0A0A0A0A0A0A"]');
    assert.equal(clearCommand("B"), "clear-2");
    assert.throws(() => waveformCommand(1, ["not-a-wave"]), /16-character hexadecimal/);
    assert.throws(() => waveformCommand(1, Array(110).fill("0A0A0A0A0A0A0A0A")), /at most 100/);
    assert.throws(() => assertMessageLength("x".repeat(MAX_MESSAGE_LENGTH + 1)), new RegExp(`exceeds ${MAX_MESSAGE_LENGTH}`));
  });
  it("parses strength and feedback reports", () => {
    assert.deepEqual(parseAppReport("strength-1+2+123"), { type: "strength", channel: 1, value: 123, raw: "strength-1+2+123" });
    assert.deepEqual(parseAppReport("feedback-ok"), { type: "feedback", value: "ok", raw: "feedback-ok" });
    assert.equal(parseAppReport("unexpected"), undefined);
  });
});

import { clearedPulseChannel, controllerCommand, parseSocketEnvelope, pulseCommandChannel, punishmentDuration, socketEnvelope } from "../src/core/socket-v2.ts";

describe("DG-LAB SOCKET v2 adapter", () => {
  it("validates JSON envelopes and creates server envelopes", () => {
    assert.deepEqual(socketEnvelope("bind", "client", "", "targetId"), { type: "bind", clientId: "client", targetId: "", message: "targetId" });
    assert.deepEqual(parseSocketEnvelope('{"type":2,"clientId":"client","targetId":"app","message":"set channel","channel":1}'), { type: 2, clientId: "client", targetId: "app", message: "set channel", channel: 1 });
    assert.throws(() => parseSocketEnvelope("not-json"), /403/);
    assert.throws(() => parseSocketEnvelope('{"type":"msg"}'), /403/);
    assert.throws(() => parseSocketEnvelope("x".repeat(MAX_MESSAGE_LENGTH + 1)), /405/);
  });
  it("converts controller strength, direct, and waveform commands", () => {
    const base = { clientId: "client", targetId: "app", message: "set channel" };
    assert.equal(controllerCommand({ ...base, type: 1, channel: "A" }), "strength-1+0+1");
    assert.equal(controllerCommand({ ...base, type: 2, channel: 2 }), "strength-2+1+1");
    assert.equal(controllerCommand({ ...base, type: 3, channel: "B", strength: 35 }), "strength-2+2+35");
    assert.equal(controllerCommand({ ...base, type: 4, message: "clear-1" }), "clear-1");
    assert.equal(controllerCommand({ ...base, type: "clientMsg", channel: "A", message: 'A:["0A0A0A0A64646464"]' }), 'pulse-A:["0A0A0A0A64646464"]');
    assert.throws(() => controllerCommand({ ...base, type: "clientMsg", channel: "B", message: "A:[]" }), /does not match/);
  });
  it("maps pulse and clear commands back to channels", () => {
    assert.equal(pulseCommandChannel('pulse-A:["0A0A0A0A64646464"]'), "A");
    assert.equal(pulseCommandChannel("strength-1+2+20"), undefined);
    assert.equal(clearedPulseChannel("clear-1"), "A");
    assert.equal(clearedPulseChannel("clear-2"), "B");
    assert.equal(clearedPulseChannel("clear-3"), undefined);
  });
  it("limits waveform queue sizes and punishment duration", () => {
    assert.throws(() => waveformCommand("A", Array(101).fill("0A0A0A0A64646464")), /at most 100/);
    assert.equal(punishmentDuration(undefined), 5);
    assert.equal(punishmentDuration(10), 10);
    assert.throws(() => punishmentDuration(0), /between 1 and 60/);
  });
});
