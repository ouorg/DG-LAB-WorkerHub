interface KVNamespacePutOptions { expirationTtl?: number }
interface KVNamespaceListOptions { prefix?: string; limit?: number }
interface KVNamespaceListResult { keys: Array<{ name: string }> }
interface KVNamespace {
  get(key: string): Promise<string | null>;
  get<T = string>(key: string, type: "json"): Promise<T | null>;
  put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult>;
}
interface D1Result<T = unknown> { results?: T[]; success: boolean; meta: unknown }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
interface D1Database { prepare(query: string): D1PreparedStatement; batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>; exec(query: string): Promise<unknown> }
interface R2HTTPMetadata { contentType?: string }
interface R2PutOptions { httpMetadata?: R2HTTPMetadata }
interface R2Bucket { put(key: string, value: string | ArrayBuffer | ArrayBufferView | Blob, options?: R2PutOptions): Promise<unknown>; delete(key: string): Promise<void> }
interface DurableObjectId {}
interface DurableObjectStub { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> }
interface DurableObjectNamespace { idFromName(name: string): DurableObjectId; get(id: DurableObjectId): DurableObjectStub }
interface DurableObjectStorage { get<T>(key: string): Promise<T | undefined>; put<T>(key: string, value: T): Promise<void> }
interface DurableObjectState { storage: DurableObjectStorage; blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> }
interface DurableObject { fetch(request: Request): Promise<Response> }
interface ResponseInit { webSocket?: WebSocket }
interface WebSocket { accept(): void }
declare class WebSocketPair { 0: WebSocket; 1: WebSocket }
interface ExportedHandler<Env> { fetch(request: Request, env: Env): Promise<Response> }
