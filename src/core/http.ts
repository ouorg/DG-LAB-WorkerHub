export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export const json = (value: unknown, status = 200) => Response.json(value, { status });
export const html = (value: string) => new Response(value, { headers: { "content-type": "text/html; charset=utf-8" } });

export async function jsonBody<T>(request: Request): Promise<T> {
  try { return await request.json() as T; }
  catch { throw new HttpError(400, "request body must be valid JSON"); }
}
