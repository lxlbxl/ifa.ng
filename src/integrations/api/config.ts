/** Where our own API lives (Hono server, Better Auth at /api/auth, PostgREST at /rest/v1). */
export const API_URL = String(import.meta.env.VITE_API_URL ?? "http://localhost:8787").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

/** fetch against our API with the login cookie. Throws ApiError with the server's message. */
export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(typeof init.body === "string" ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const b = body as { error?: string; message?: string } | null;
    throw new ApiError(b?.message || b?.error || `Request failed (${res.status})`, res.status, body);
  }
  return body as T;
}
