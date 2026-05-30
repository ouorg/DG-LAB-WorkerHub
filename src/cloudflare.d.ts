interface KVNamespacePutOptions { expirationTtl?: number }
interface KVNamespaceListOptions { prefix?: string; limit?: number }
interface KVNamespaceListResult { keys: Array<{ name: string }> }
interface KVNamespace {
  get<T = string>(key: string, type: "json"): Promise<T | null>;
  put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void>;
  list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult>;
}
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
