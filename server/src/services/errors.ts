/**
 * Sends unexpected server errors to Sentry when SENTRY_DSN is set (no SDK: one HTTPS call per
 * error, never blocking the request). Without a DSN it only logs, as before.
 */
let dsn: { url: string; key: string } | null = null;
let environment = "production";
let fetcher: typeof fetch = globalThis.fetch;

export function initErrorReporting(opts: { dsn?: string; environment?: string; fetch?: typeof fetch }) {
  dsn = parseDsn(opts.dsn);
  environment = opts.environment ?? environment;
  if (opts.fetch) fetcher = opts.fetch;
}

export function parseDsn(raw?: string): { url: string; key: string } | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const project = u.pathname.replace(/^\//, "");
    if (!u.username || !project) return null;
    return { url: `${u.protocol}//${u.host}/api/${project}/envelope/`, key: u.username };
  } catch {
    return null;
  }
}

/** Build a Sentry envelope for one exception (exported for tests). */
export function envelope(err: unknown, context: Record<string, unknown>, env: string): string {
  const e = err instanceof Error ? err : new Error(String(err));
  const id = crypto.randomUUID().replace(/-/g, "");
  const frames = (e.stack ?? "").split("\n").slice(1, 30).map((l) => ({ function: l.trim() })).reverse();
  const event = {
    event_id: id, timestamp: Date.now() / 1000, platform: "node", level: "error", environment: env,
    server_name: "ifa-api", extra: context,
    exception: { values: [{ type: e.name, value: e.message.slice(0, 1000), stacktrace: { frames } }] },
  };
  return `${JSON.stringify({ event_id: id, sent_at: new Date().toISOString() })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}\n`;
}

export function reportError(err: unknown, context: Record<string, unknown> = {}) {
  console.error(err, Object.keys(context).length ? context : "");
  if (!dsn) return;
  const target = dsn;
  fetcher(target.url, {
    method: "POST",
    headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=ifa-api/1.0` },
    body: envelope(err, context, environment),
  }).catch(() => { /* never let reporting break anything */ });
}
