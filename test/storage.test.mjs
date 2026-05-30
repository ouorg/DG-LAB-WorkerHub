import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CACHE_TTL_SECONDS, DEFAULT_SESSION_TTL_SECONDS, kvKeys, MIN_SESSION_TTL_SECONDS, sessionTtlSeconds } from "../src/core/config.ts";
import { auditArchiveKey, exportKey, waveformKey } from "../src/storage/r2.ts";

 describe("storage configuration", () => {
  it("keeps one HUB_KV namespace logically isolated with stable prefixes", () => {
    assert.equal(kvKeys.session("session-id"), "session:session-id");
    assert.equal(kvKeys.rateLimit("ip:127.0.0.1:login"), "rl:ip:127.0.0.1:login");
    assert.equal(kvKeys.deviceState("device-id"), "device:state:device-id");
    assert.equal(kvKeys.deviceBinding("device-id"), "device:binding:device-id");
  });

  it("normalizes session TTL configuration", () => {
    assert.equal(sessionTtlSeconds(undefined), DEFAULT_SESSION_TTL_SECONDS);
    assert.equal(sessionTtlSeconds("invalid"), DEFAULT_SESSION_TTL_SECONDS);
    assert.equal(sessionTtlSeconds("30"), MIN_SESSION_TTL_SECONDS);
    assert.equal(sessionTtlSeconds("3600"), 3600);
    assert.deepEqual(CACHE_TTL_SECONDS, { binding: 300, deviceState: 120 });
  });
});

describe("R2 object keys", () => {
  it("builds predictable keys for assets and archives", () => {
    assert.equal(waveformKey("user", "wave"), "waveforms/user/wave.json");
    assert.equal(exportKey("user", "bundle.zip"), "exports/user/bundle.zip");
    assert.equal(auditArchiveKey(new Date("2026-05-03T00:00:00Z"), "device"), "audit/2026/05/03/device.jsonl");
  });
});
