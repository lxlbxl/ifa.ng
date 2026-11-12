/**
 * Reports uncaught browser errors to Sentry when VITE_SENTRY_DSN is set at build time.
 * No SDK and no personal data: the error, the page path and the browser.
 */
import { errorReportsAllowed } from './privacy';

const raw = import.meta.env.VITE_SENTRY_DSN as string | undefined;

function target() {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const project = u.pathname.replace(/^\//, '');
    return u.username && project ? { url: `${u.protocol}//${u.host}/api/${project}/envelope/?sentry_key=${u.username}&sentry_version=7`, key: u.username } : null;
  } catch { return null; }
}

let sent = 0;
export function reportClientError(err: unknown, extra: Record<string, unknown> = {}) {
  const t = target();
  if (!t || sent >= 20 || !errorReportsAllowed()) return; // the visitor can turn these off (Privacy choices) // a broken page shouldn't flood the inbox
  sent++;
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
  const id = crypto.randomUUID().replace(/-/g, '');
  const event = {
    event_id: id, timestamp: Date.now() / 1000, platform: 'javascript', level: 'error', environment: import.meta.env.MODE,
    request: { url: location.origin + location.pathname, headers: { 'User-Agent': navigator.userAgent } }, extra,
    exception: { values: [{ type: e.name, value: e.message.slice(0, 1000), stacktrace: { frames: (e.stack ?? '').split('\n').slice(0, 30).map((l) => ({ function: l.trim() })).reverse() } }] },
  };
  const body = `${JSON.stringify({ event_id: id, sent_at: new Date().toISOString() })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}\n`;
  fetch(t.url, { method: 'POST', body, keepalive: true }).catch(() => {});
}

export function initErrorReporting() {
  if (!target()) return;
  window.addEventListener('error', (e) => reportClientError(e.error ?? e.message, { source: e.filename, line: e.lineno }));
  window.addEventListener('unhandledrejection', (e) => reportClientError(e.reason, { kind: 'unhandledrejection' }));
}
