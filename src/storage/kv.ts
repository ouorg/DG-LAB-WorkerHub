const json = <T>(value: T) => JSON.stringify(value);

export async function readJson<T>(namespace: KVNamespace, key: string): Promise<T | null> {
  return namespace.get<T>(key, "json");
}

export async function writeJson<T>(namespace: KVNamespace, key: string, value: T, expirationTtl?: number): Promise<void> {
  await namespace.put(key, json(value), expirationTtl === undefined ? undefined : { expirationTtl: Math.max(60, expirationTtl) });
}

export async function incrementWindow(namespace: KVNamespace, key: string, limit: number, expirationTtl: number): Promise<boolean> {
  const count = Number(await namespace.get(key) ?? "0");
  if (count >= limit) return false;
  await namespace.put(key, String(count + 1), { expirationTtl: Math.max(60, expirationTtl) });
  return true;
}
