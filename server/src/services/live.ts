import pg from "pg";
import { sql } from "kysely";
import { asService, type Services } from "./context.js";

/**
 * Live notifications (replaces Supabase Realtime for the notifications table).
 *
 * One Postgres connection LISTENs on 'ifa_notifications'. When a row is
 * inserted, the trigger sends {id, user_id}; we read the row as the service and
 * hand it to that person's open streams only. Reconnects on its own.
 */
type Send = (row: Record<string, unknown>) => void;

export function createLiveHub(svc: Services, connectionString: string,
  opts: { onNotification?: (id: string, userId: string) => void } = {}) {
  const subscribers = new Map<string, Set<Send>>();
  let client: pg.Client | null = null;
  let closed = false;
  let retry: NodeJS.Timeout | undefined;

  async function deliver(payload: string) {
    let msg: { id?: string; user_id?: string };
    try { msg = JSON.parse(payload); } catch { return; }
    if (msg.id && msg.user_id) opts.onNotification?.(msg.id, msg.user_id);
    const subs = msg.user_id ? subscribers.get(msg.user_id) : undefined;
    if (!subs?.size || !msg.id) return;
    const row = (await asService(svc, (trx) => sql<Record<string, unknown>>`
      select * from public.notifications where id = ${msg.id}::uuid and user_id = ${msg.user_id}::uuid`.execute(trx))).rows[0];
    if (row) subs.forEach((send) => send(row));
  }

  async function connect() {
    if (closed) return;
    const c = new pg.Client({ connectionString });
    c.on("notification", (n) => { if (n.payload) deliver(n.payload).catch((e) => console.error("live deliver", e)); });
    c.on("error", (e) => {
      console.error("live listener error", e.message);
      c.end().catch(() => {});
      if (client === c) client = null;
      if (!closed) retry = setTimeout(connect, 2000);
    });
    try {
      await c.connect();
      await c.query("LISTEN ifa_notifications");
      client = c;
    } catch (e) {
      console.error("live listener connect failed", (e as Error).message);
      c.end().catch(() => {});
      if (!closed) retry = setTimeout(connect, 5000);
    }
  }

  const ready = connect();

  return {
    ready,
    subscribe(userId: string, send: Send) {
      let set = subscribers.get(userId);
      if (!set) subscribers.set(userId, (set = new Set()));
      set.add(send);
      return () => { set!.delete(send); if (!set!.size) subscribers.delete(userId); };
    },
    async close() {
      closed = true;
      clearTimeout(retry);
      await client?.end().catch(() => {});
    },
  };
}

export type LiveHub = ReturnType<typeof createLiveHub>;
