import type { Env } from "../types";

import { defaultSettings } from "../core/config";

export async function bootstrapDb(env: Env): Promise<void> {
  const completed = await env.DB.prepare("SELECT value FROM settings WHERE key = 'bootstrap.completed'").first<{ value: string }>();
  if (completed?.value === "true") return;
  const now = new Date().toISOString();
  const statements = defaultSettings.map(([key, value]) => env.DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING"
  ).bind(key, value, now));
  statements.push(env.DB.prepare(
    "INSERT INTO users (id, username, display_name, role, created_at, updated_at) VALUES (?, ?, ?, 'admin', ?, ?) ON CONFLICT(id) DO NOTHING"
  ).bind("bootstrap", "admin", "Administrator", now, now));
  await env.DB.batch(statements);
}
