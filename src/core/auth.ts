import { LOGIN_RATE_LIMIT } from "./config";
import { HttpError } from "./http";
import type { Store } from "./store";
import type { Session } from "../types";

const digest = (value: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

export async function matchesPassword(input: unknown, expected: string | undefined): Promise<boolean> {
  if (typeof input !== "string" || !input || !expected) return false;
  const [actualHash, expectedHash] = await Promise.all([digest(input), digest(expected)]);
  const actual = new Uint8Array(actualHash), wanted = new Uint8Array(expectedHash);
  let mismatch = actual.length ^ wanted.length;
  for (let index = 0; index < actual.length; index++) mismatch |= actual[index] ^ wanted[index];
  return mismatch === 0;
}

export async function enforceLoginRateLimit(request: Request, store: Store): Promise<void> {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!await store.rateLimit(`ip:${ip}:login`, LOGIN_RATE_LIMIT.attempts, LOGIN_RATE_LIMIT.windowSeconds)) {
    throw new HttpError(429, "login rate limit exceeded");
  }
}

export async function requireSession(request: Request, store: Store): Promise<Session> {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) throw new HttpError(401, "authentication required");
  const session = await store.session(value.slice(7));
  if (!session) throw new HttpError(401, "session is missing or expired");
  return session;
}
