import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearCommand, MAX_MESSAGE_LENGTH, parseAppReport, strengthCommand, waveformCommand } from "../src/core/protocol.ts";

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
    assert.throws(() => waveformCommand(1, Array(110).fill("0A0A0A0A0A0A0A0A")), new RegExp(`exceeds ${MAX_MESSAGE_LENGTH}`));
  });
  it("parses strength and feedback reports", () => {
    assert.deepEqual(parseAppReport("strength-1+2+123"), { type: "strength", channel: 1, value: 123, raw: "strength-1+2+123" });
    assert.deepEqual(parseAppReport("feedback-ok"), { type: "feedback", value: "ok", raw: "feedback-ok" });
    assert.equal(parseAppReport("unexpected"), undefined);
  });
});
