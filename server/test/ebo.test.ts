import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { freshDatabase } from "./helpers.js";

/**
 * Ebo money flow, end to end in the database, acting as each person through
 * the same role and functions the app uses. The platform fee is 10% (default), added on top.
 */
const BABA = "00000000-0000-0000-0000-0000000000b1";
const CLIENT = "00000000-0000-0000-0000-0000000000c1";
const OTHER = "00000000-0000-0000-0000-0000000000c2";
const ADMIN = "00000000-0000-0000-0000-0000000000ad";
let admin: pg.Client;
let dbUrl = "";
let sessionId = "";

async function as<T = any>(who: string | null, text: string, params: unknown[] = []): Promise<{ ok: true; rows: T[] } | { ok: false; code: string; message: string }> {
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();
  try {
    if (who) {
      await c.query("set role authenticated");
      await c.query("select set_config('request.jwt.claim.sub', $1, false)", [who]);
    } else {
      await c.query("set role service_role");
    }
    const r = await c.query(text, params);
    return { ok: true, rows: r.rows };
  } catch (e: any) {
    return { ok: false, code: e.code, message: e.message };
  } finally {
    await c.end();
  }
}
const must = async <T = any>(who: string | null, text: string, params: unknown[] = []) => {
  const r = await as<T>(who, text, params);
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`);
  return r.rows;
};
const wallet = async (u: string) => Number((await admin.query("select balance from wallets where user_id=$1", [u])).rows[0]?.balance ?? 0);
const bw = async () => (await admin.query("select pending_balance::float p, available_balance::float a from babalawo_wallets where babalawo_id=$1", [BABA])).rows[0];
const ebo = async (id: string) => (await admin.query("select * from ebo_prescriptions where id=$1", [id])).rows[0];

const ITEMS = [
  { name: "Ẹyẹlé", quantity: 2, unit: "bird", unit_price: 5000 },
  { name: "Obì àbàtà", quantity: 4, unit_price: 500 },
];
async function draft(owo = 20000, items: unknown[] = ITEMS) {
  const r = await must(BABA, "select public.ebo_save_draft(null,$1,'ebo','Ebo for open roads','At the crossroads','babalawo',null,$2,$3::jsonb, now() + interval '2 days', 60) id",
    [sessionId, owo, JSON.stringify(items)]);
  return r[0].id as string;
}
async function sentEbo() {
  const id = await draft();
  await must(BABA, "select public.ebo_send($1)", [id]);
  return id;
}
async function addProof(id: string, kind = "video") {
  await admin.query("insert into ebo_proofs(prescription_id,kind,status,storage_path,content_type,size_bytes,uploaded_by) values ($1,$2,'processing','x/y.mp4','video/mp4',10,$3)", [id, kind, BABA]);
}

beforeAll(async () => {
  dbUrl = await freshDatabase("ifa_test_ebo");
  await migrate(dbUrl, undefined, () => {});
  admin = new pg.Client({ connectionString: dbUrl });
  await admin.connect();
  await admin.query(`insert into auth.users(id,email,raw_user_meta_data) values
    ('${CLIENT}','c@x.ng','{}'), ('${OTHER}','o@x.ng','{}'), ('${ADMIN}','ad@x.ng','{}'), ('${BABA}','b@x.ng','{"role":"babalawo"}')`);
  await admin.query(`insert into user_roles(user_id, role) values ('${ADMIN}','admin') on conflict do nothing`);
  await admin.query(`insert into wallets(user_id,balance) values ('${CLIENT}', 1000000), ('${OTHER}', 1000000)
    on conflict (user_id) do update set balance = excluded.balance`);
  const s = await admin.query(`insert into sessions(user_id,babalawo_id,session_date,start_time,end_time,status,payment_status,amount)
    values ('${CLIENT}','${BABA}', current_date, '10:00','11:00','completed','paid',15000) returning id::text`);
  sessionId = s.rows[0].id;
}, 60_000);
afterAll(() => admin?.end());

describe("Ebo: who can write what", () => {
  it("refuses direct inserts, so a Babalawo cannot push an Ebo into a stranger's account", async () => {
    const r = await as(BABA, `insert into ebo_prescriptions(session_id,babalawo_id,client_id,title) values ($1,$2,$3,'x')`, [sessionId, BABA, OTHER]);
    expect(r).toMatchObject({ ok: false, code: "42501" });
  });

  it("always sets the client from the session", async () => {
    const id = await draft();
    expect((await ebo(id)).client_id).toBe(CLIENT);
  });

  it("refuses another Babalawo's session", async () => {
    const r = await as(OTHER, "select public.ebo_save_draft(null,$1,'ebo','t',null,'babalawo',null,0,'[]'::jsonb)", [sessionId]);
    expect(r.ok).toBe(false);
  });

  it("keeps drafts private to the Babalawo and shows sent quotes to the client only", async () => {
    const id = await draft();
    expect(await must(CLIENT, "select id from ebo_prescriptions where id=$1", [id])).toHaveLength(0);
    await must(BABA, "select public.ebo_send($1)", [id]);
    expect(await must(CLIENT, "select id from ebo_prescriptions where id=$1", [id])).toHaveLength(1);
    expect(await must(CLIENT, "select name from ebo_items where prescription_id=$1", [id])).toHaveLength(2);
    expect(await must(OTHER, "select id from ebo_prescriptions where id=$1", [id])).toHaveLength(0);
    expect(await must(OTHER, "select id from ebo_items where prescription_id=$1", [id])).toHaveLength(0);
  });

  it("will not send an item without a price", async () => {
    const id = await draft(1000, [{ name: "Oyin", quantity: 1, unit_price: 0 }]);
    const r = await as(BABA, "select public.ebo_send($1)", [id]);
    expect(r).toMatchObject({ ok: false });
  });

  it("computes the total from item lines plus Owó Ifá", async () => {
    const id = await draft();
    expect(Number((await ebo(id)).total)).toBe(2 * 5000 + 4 * 500 + 20000);
  });
});

describe("Ebo: paid in app, held until proof", () => {
  it("pays from the wallet, holds the Babalawo's share, releases items at start and the rest on confirmation", async () => {
    const id = await sentEbo(); // Ebo 32,000 (items 12,000) + 10% platform fee 3,200 = client pays 35,200
    const before = await wallet(CLIENT);
    const b0 = (await bw()) ?? { p: 0, a: 0 };
    expect((await as(OTHER, "select public.pay_ebo_with_wallet($1)", [id])).ok).toBe(false);
    await must(CLIENT, "select public.pay_ebo_with_wallet($1)", [id]);
    expect(await wallet(CLIENT)).toBe(before - 35200);
    let e = await ebo(id);
    expect(e.status).toBe("paid");
    expect(Number(e.platform_fee)).toBe(3200);
    expect(Number(e.babalawo_amount)).toBe(32000);
    const pay = (await admin.query("select amount::float, commission_amount::float c, babalawo_amount::float b from payments where ebo_id=$1", [id])).rows[0];
    expect(pay).toEqual({ amount: 35200, c: 3200, b: 32000 });
    let b = await bw();
    expect(b.p - b0.p).toBe(32000);
    // paying twice is refused
    expect((await as(CLIENT, "select public.pay_ebo_with_wallet($1)", [id])).ok).toBe(false);

    await must(BABA, "select public.ebo_mark_started($1)", [id]);
    b = await bw();
    expect(b.a - b0.a).toBe(12000);
    expect(b.p - b0.p).toBe(20000);

    expect((await as(BABA, "select public.ebo_mark_performed($1,'done')", [id])).ok).toBe(false); // no proof yet
    await addProof(id);
    await must(BABA, "select public.ebo_mark_performed($1,'done')", [id]);
    expect((await ebo(id)).status).toBe("performed");

    await must(CLIENT, "select public.ebo_confirm($1)", [id]);
    e = await ebo(id);
    expect(e.status).toBe("completed");
    b = await bw();
    expect(b.a - b0.a).toBe(32000);
    expect(b.p - b0.p).toBe(0);
    const ledger = (await admin.query("select entry_type, amount::float from babalawo_ledger where ebo_id=$1 order by created_at", [id])).rows;
    expect(ledger.map((l) => l.entry_type)).toEqual(["ebo_earning", "ebo_items_release", "ebo_final_release"]);
  });

  it("lets the client decline, and the Babalawo revise with a recorded reason", async () => {
    const id = await sentEbo();
    expect((await as(BABA, "select public.ebo_revise($1, 15000, $2::jsonb, null, '')", [id, JSON.stringify(ITEMS)])).ok).toBe(false);
    await must(BABA, "select public.ebo_revise($1, 15000, $2::jsonb, null, 'Pigeons are cheaper this week')", [id, JSON.stringify(ITEMS)]);
    const e = await ebo(id);
    expect(Number(e.total)).toBe(27000);
    expect(e.version).toBe(2);
    const ev = (await admin.query("select data from ebo_events where prescription_id=$1 and event='revised'", [id])).rows[0];
    expect(ev.data.before.total).toBe(32000);
    expect(Number(e.amount_due)).toBe(29700);
    await must(CLIENT, "select public.ebo_decline($1,'Not now')", [id]);
    expect((await ebo(id)).status).toBe("declined");
    expect((await as(CLIENT, "select public.pay_ebo_with_wallet($1)", [id])).ok).toBe(false);
  });

  it("refunds in full when the Babalawo cancels a paid Ebo before starting", async () => {
    const id = await sentEbo();
    const before = await wallet(CLIENT);
    const b0 = await bw();
    await must(CLIENT, "select public.pay_ebo_with_wallet($1)", [id]);
    await must(BABA, "select public.ebo_cancel($1,'Cannot travel this week')", [id]);
    expect(await wallet(CLIENT)).toBe(before);
    expect((await ebo(id)).status).toBe("refunded");
    const b = await bw();
    expect(b.p).toBe(b0.p);
  });

  it("freezes money on dispute; admin full refund takes back released item money", async () => {
    const id = await sentEbo();
    const before = await wallet(CLIENT);
    const b0 = await bw();
    await must(CLIENT, "select public.pay_ebo_with_wallet($1)", [id]);
    await must(BABA, "select public.ebo_mark_started($1)", [id]);
    expect((await as(CLIENT, "select public.ebo_dispute($1,'short')", [id])).ok).toBe(false);
    await must(CLIENT, "select public.ebo_dispute($1,'Nothing has happened for two weeks')", [id]);
    expect((await ebo(id)).status).toBe("disputed");
    expect(await must(CLIENT, "select id from disputes where ebo_id=$1", [id])).toHaveLength(1);
    // a disputed Ebo is not auto-released
    await must(null, "select public.ebo_tick()");
    expect((await ebo(id)).status).toBe("disputed");
    expect((await as(CLIENT, "select public.admin_resolve_ebo($1,'refund_full','x y z')", [id])).ok).toBe(false);
    await must(ADMIN, "select public.admin_resolve_ebo($1,'refund_full','Babalawo did not perform')", [id]);
    expect(await wallet(CLIENT)).toBe(before);
    const b = await bw();
    expect(b.p).toBe(b0.p);
    expect(b.a).toBe(b0.a);
    expect((await admin.query("select status from disputes where ebo_id=$1", [id])).rows[0].status).toBe("resolved_refund");
  });

  it("admin can refund only what is still held", async () => {
    const id = await sentEbo();
    const before = await wallet(CLIENT);
    await must(CLIENT, "select public.pay_ebo_with_wallet($1)", [id]);
    await must(BABA, "select public.ebo_mark_started($1)", [id]);
    await must(CLIENT, "select public.ebo_dispute($1,'Only half of it was done')", [id]);
    const r = await must(ADMIN, "select public.admin_resolve_ebo($1,'refund_held','Items were bought, fee refunded') r", [id]);
    expect(r[0].r.refunded).toBe(20000);
    expect(await wallet(CLIENT)).toBe(before - 35200 + 20000);
  });

  it("releases automatically once the confirmation window passes, and expires unpaid quotes", async () => {
    const paid = await sentEbo();
    await must(CLIENT, "select public.pay_ebo_with_wallet($1)", [paid]);
    await addProof(paid);
    await must(BABA, "select public.ebo_mark_performed($1,null)", [paid]);
    const stale = await sentEbo();
    await admin.query("update ebo_prescriptions set confirm_by = now() - interval '1 minute' where id=$1", [paid]);
    await admin.query("update ebo_prescriptions set expires_at = now() - interval '1 minute' where id=$1", [stale]);
    const r = await must(null, "select public.ebo_tick() r");
    expect(r[0].r.auto_completed).toBeGreaterThanOrEqual(1);
    expect((await ebo(paid)).status).toBe("completed");
    expect((await ebo(stale)).status).toBe("expired");
    expect((await as(CLIENT, "select public.pay_ebo_with_wallet($1)", [stale])).ok).toBe(false);
  });
});

describe("Ebo: ritual time and attendance", () => {
  it("creates a free, already-paid ritual session when the client will join live", async () => {
    const id = await sentEbo();
    const before = await wallet(CLIENT);
    await must(CLIENT, "select public.pay_ebo_with_wallet($1,'present')", [id]);
    expect(await wallet(CLIENT)).toBe(before - 35200); // only the Ebo and its fee, nothing for the ritual session
    const e = await ebo(id);
    expect(e.attendance).toBe("present");
    const s = (await admin.query("select * from sessions where id=$1", [e.ritual_session_id])).rows[0];
    expect(s).toMatchObject({ session_type: "ebo_ritual", ebo_id: id, payment_status: "paid", status: "confirmed" });
    expect(Number(s.amount)).toBe(0);
    expect(await must(CLIENT, "select id from sessions where id=$1", [e.ritual_session_id])).toHaveLength(1);
    // performed only once the ritual time has come; no video needed when the client was there
    expect((await as(BABA, "select public.ebo_mark_performed($1,null)", [id])).ok).toBe(false);
    await admin.query("update ebo_prescriptions set ritual_at = now() - interval '1 minute' where id=$1", [id]);
    await must(BABA, "select public.ebo_mark_performed($1,null)", [id]);
    // switching to absent closes the live session; refunds cancel it too
  });

  it("requires a ritual time before sending, and a video (not a photo) when the client is absent", async () => {
    const r = await must(BABA, "select public.ebo_save_draft(null,$1,'ebo','No time yet',null,'babalawo',null,1000,'[]'::jsonb) id", [sessionId]);
    expect((await as(BABA, "select public.ebo_send($1)", [r[0].id])).ok).toBe(false);
    const id = await sentEbo();
    await must(CLIENT, "select public.pay_ebo_with_wallet($1,'absent')", [id]);
    expect((await ebo(id)).ritual_session_id).toBeNull();
    await addProof(id, "photo");
    expect((await as(BABA, "select public.ebo_mark_performed($1,null)", [id])).ok).toBe(false);
    await addProof(id, "video");
    await must(BABA, "select public.ebo_mark_performed($1,null)", [id]);
  });

  it("moves the live session when the Babalawo reschedules, and drops it if the client switches to absent", async () => {
    const id = await sentEbo();
    await must(CLIENT, "select public.pay_ebo_with_wallet($1,'present')", [id]);
    const sid = (await ebo(id)).ritual_session_id;
    await must(BABA, "select public.ebo_reschedule($1, now() + interval '5 days', 'Market day clash')", [id]);
    expect((await ebo(id)).ritual_session_id).toBe(sid);
    expect((await admin.query("select count(*)::int n from notification_outbox where session_id=$1 and kind='rescheduled'", [sid])).rows[0].n).toBe(1);
    await must(CLIENT, "select public.ebo_set_attendance($1,'absent')", [id]);
    expect((await admin.query("select status from sessions where id=$1", [sid])).rows[0].status).toBe("cancelled");
    expect((await ebo(id)).ritual_session_id).toBeNull();
  });

  it("lets the client ask for another time before paying", async () => {
    const id = await sentEbo();
    await must(CLIENT, "select public.ebo_request_time($1,'Weekends only please')", [id]);
    expect((await admin.query("select count(*)::int n from ebo_events where prescription_id=$1 and event='time_requested'", [id])).rows[0].n).toBe(1);
  });
});

describe("Ebo: card payments", () => {
  it("charges the server's total and settles once", async () => {
    const id = await sentEbo();
    const r = await must(null, "select * from public.create_payment_intent($1,'ebo','paystack',1,null,null,null,false,$2,'present')", [CLIENT, id]);
    expect(Number(r[0].amount)).toBe(35200);
    expect((await as(null, "select * from public.create_payment_intent($1,'ebo','paystack',null,null,null,null,false,$2,'absent')", [OTHER, id])).ok).toBe(false);
    const s1 = await must(null, "select public.settle_payment_intent($1, 35200, 'NGN', 'tx1') r", [r[0].reference]);
    expect(s1[0].r.status).toBe("settled");
    expect((await ebo(id)).status).toBe("paid");
    expect((await ebo(id)).attendance).toBe("present");
    expect(s1[0].r.session_id).toBe(Number((await ebo(id)).ritual_session_id));
    const s2 = await must(null, "select public.settle_payment_intent($1, 35200, 'NGN', 'tx1') r", [r[0].reference]);
    expect(s2[0].r.status).toBe("already_settled");
  });

  it("puts the money in the client's wallet if the Ebo was withdrawn while they paid", async () => {
    const id = await sentEbo();
    const r = await must(null, "select * from public.create_payment_intent($1,'ebo','flutterwave',null,null,null,null,false,$2,'absent')", [CLIENT, id]);
    await must(BABA, "select public.ebo_cancel($1,'Changed my mind')", [id]);
    const before = await wallet(CLIENT);
    const s = await must(null, "select public.settle_payment_intent($1, 35200, 'NGN', 'tx2') r", [r[0].reference]);
    expect(s[0].r.status).toBe("ebo_unavailable_credited_to_wallet");
    expect(await wallet(CLIENT)).toBe(before + 35200);
  });

  it("does not let clients call the settlement functions", async () => {
    expect((await as(CLIENT, "select public.settle_payment_intent('x', 1, 'NGN', 'y')")).ok).toBe(false);
    expect((await as(CLIENT, "select public._ebo_mark_paid(gen_random_uuid(),'wallet','r',null,true)")).ok).toBe(false);
    expect((await as(CLIENT, "select public.ebo_tick()")).ok).toBe(false);
  });
});

describe("Ebo: client-performed guidance and AI drafts", () => {
  it("lets the client track a self-performed Ebo without payment", async () => {
    const r = await must(BABA, "select public.ebo_save_draft(null,$1,'etutu','Give alms on Friday',null,'client',null,5000,'[]'::jsonb) id", [sessionId]);
    const id = r[0].id;
    expect(Number((await ebo(id)).owo_ifa)).toBe(0);
    await must(BABA, "select public.ebo_send($1)", [id]);
    await must(CLIENT, "select public.set_ebo_status($1,'completed')", [id]);
    expect((await ebo(id)).status).toBe("completed");
    expect((await as(CLIENT, "select public.pay_ebo_with_wallet($1)", [id])).ok).toBe(false);
  });

  it("turns Ebo heard in the session into drafts without prices for the Babalawo", async () => {
    const s = await admin.query(`insert into sessions(user_id,babalawo_id,session_date,start_time,end_time,status,payment_status,amount)
      values ('${CLIENT}','${BABA}', current_date, '12:00','13:00','completed','paid',15000) returning id::text`);
    const n = await must(null, "select public.ebo_ai_draft($1, $2::jsonb) n", [s.rows[0].id,
      JSON.stringify([{ title: "Ebo for health", kind: "ebo", items: [{ name: "Àkùkọ adìyẹ", quantity: 1 }] }])]);
    expect(n[0].n).toBe(1);
    const e = (await admin.query("select * from ebo_prescriptions where session_id=$1", [s.rows[0].id])).rows[0];
    expect(e).toMatchObject({ status: "draft", ai_suggested: true, client_id: CLIENT });
    expect(await must(CLIENT, "select id from ebo_prescriptions where id=$1", [e.id])).toHaveLength(0);
  });
});
