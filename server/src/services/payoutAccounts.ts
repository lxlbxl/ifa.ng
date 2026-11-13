import { sql } from "kysely";
import { asService, HttpError, type Services } from "./context.js";
import { stepUpHash } from "./phoneAuth.js";

/**
 * Babalawo payout accounts. The browser sends a bank and an account number; the server asks a
 * provider whose name is on the account, compares it with the Babalawo's name in the database
 * (_save_bank_account), and only saves after the Babalawo has typed their PIN again (a step-up
 * token from /api/auth/phone/confirm-pin). The account name always comes from the provider.
 */

type Provider = "paystack" | "flutterwave";
type Bank = { id: number; name: string; paystack_code: string | null; flutterwave_code: string | null };

const ACCOUNT = /^\d{10}$/;

async function bankById(svc: Services, bankId: unknown): Promise<Bank> {
  const id = Number(bankId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Choose your bank from the list");
  const r = await asService(svc, (trx) => sql<Bank>`
    select id, name, paystack_code, flutterwave_code from public.payout_banks where id = ${id} and active`.execute(trx));
  if (!r.rows[0]) throw new HttpError(400, "Choose your bank from the list");
  return r.rows[0];
}

async function requireBabalawo(svc: Services, userId: string) {
  const r = await asService(svc, (trx) => sql<{ ok: boolean }>`
    select exists (select 1 from public.babalawos where user_id = ${userId}::uuid) ok`.execute(trx));
  if (!r.rows[0]?.ok) throw new HttpError(403, "Only Babalawos add payout accounts");
}

/** Ask a provider for the name on the account. Paystack first when it knows the bank, else Flutterwave. */
export async function lookupAccountName(svc: Services, bank: Bank, account: string): Promise<{ name: string; provider: Provider }> {
  const ps = svc.config.PAYSTACK_SECRET_KEY;
  const fw = svc.config.FLW_SECRET_KEY;
  const tries: Provider[] = [];
  if (ps && bank.paystack_code) tries.push("paystack");
  if (fw && bank.flutterwave_code) tries.push("flutterwave");
  if (tries.length === 0) throw new HttpError(503, "Bank checks are not set up yet. Please try again later.");
  let notFound = false;
  for (const p of tries) {
    try {
      if (p === "paystack") {
        const r = await svc.fetch(`https://api.paystack.co/bank/resolve?account_number=${account}&bank_code=${encodeURIComponent(bank.paystack_code!)}`,
          { headers: { Authorization: `Bearer ${ps}` } });
        const j = (await r.json().catch(() => ({}))) as { status?: boolean; data?: { account_name?: string } };
        if (r.ok && j.status && j.data?.account_name) return { name: j.data.account_name.trim(), provider: p };
        if (r.status === 422 || r.status === 400 || r.status === 404) { notFound = true; continue; }
      } else {
        const r = await svc.fetch("https://api.flutterwave.com/v3/accounts/resolve", {
          method: "POST", headers: { Authorization: `Bearer ${fw}`, "content-type": "application/json" },
          body: JSON.stringify({ account_number: account, account_bank: bank.flutterwave_code }),
        });
        const j = (await r.json().catch(() => ({}))) as { status?: string; data?: { account_name?: string } };
        if (r.ok && j.status === "success" && j.data?.account_name) return { name: j.data.account_name.trim(), provider: p };
        if (r.status === 400 || r.status === 404 || r.status === 422) { notFound = true; continue; }
      }
    } catch (e) {
      console.warn(`[payouts] ${p} account lookup failed:`, (e as Error).message);
    }
  }
  if (notFound) throw new HttpError(400, "We couldn't find that account. Check the bank and the 10-digit number.");
  throw new HttpError(502, "The bank check is not answering right now. Please try again in a few minutes.");
}

/** Show the Babalawo the name on the account before they confirm it. Limited per hour. */
export async function resolveForBabalawo(svc: Services, userId: string, body: Record<string, unknown>) {
  await requireBabalawo(svc, userId);
  const account = String(body.account_number ?? "").replace(/\s+/g, "");
  if (!ACCOUNT.test(account)) throw new HttpError(400, "Account numbers have 10 digits");
  const bank = await bankById(svc, body.bank_id);
  const allowed = await asService(svc, (trx) => sql<{ ok: boolean }>`
    select public._bank_lookup_allowed(${userId}::uuid, ${bank.name}, ${account}) ok`.execute(trx));
  if (!allowed.rows[0]?.ok) throw new HttpError(429, "Too many account checks. Please try again in an hour.");
  const found = await lookupAccountName(svc, bank, account);
  return { account_name: found.name, bank_name: bank.name };
}

/** Paystack keeps a "transfer recipient" per account; create it now so payouts don't need a lookup. */
async function paystackRecipient(svc: Services, bank: Bank, account: string, name: string): Promise<string | null> {
  const ps = svc.config.PAYSTACK_SECRET_KEY;
  if (!ps || !bank.paystack_code) return null;
  try {
    const r = await svc.fetch("https://api.paystack.co/transferrecipient", {
      method: "POST", headers: { Authorization: `Bearer ${ps}`, "content-type": "application/json" },
      body: JSON.stringify({ type: "nuban", name, account_number: account, bank_code: bank.paystack_code, currency: "NGN" }),
    });
    const j = (await r.json().catch(() => ({}))) as { status?: boolean; data?: { recipient_code?: string } };
    return r.ok && j.status && j.data?.recipient_code ? j.data.recipient_code : null;
  } catch (e) {
    console.warn("[payouts] Paystack recipient not created:", (e as Error).message);
    return null; // made again when the first payout is sent
  }
}

export type SavedAccount = { status: string; account_name: string; bank_name: string; name_match: number; usable_from: string };

/** Save the account: looked up again here (never trusting the earlier answer), after the PIN step-up. */
export async function saveForBabalawo(svc: Services, userId: string, body: Record<string, unknown>): Promise<SavedAccount> {
  await requireBabalawo(svc, userId);
  const account = String(body.account_number ?? "").replace(/\s+/g, "");
  if (!ACCOUNT.test(account)) throw new HttpError(400, "Account numbers have 10 digits");
  if (typeof body.step_up !== "string" || !body.step_up) throw new HttpError(403, "Please confirm your PIN first");
  const bank = await bankById(svc, body.bank_id);
  const found = await lookupAccountName(svc, bank, account);

  const recipient = await paystackRecipient(svc, bank, account, found.name);
  // Spend the PIN confirmation and save together, so a refused change doesn't use it up.
  try {
    return await asService(svc, async (trx) => {
      const used = await sql<{ ok: number }>`
        update auth.step_ups set used_at = now()
         where token_hash = ${stepUpHash(body.step_up as string)} and user_id = ${userId}::uuid and purpose = 'payout_account'
           and used_at is null and expires_at > now()
        returning 1 ok`.execute(trx);
      if (!used.rows[0]) throw new HttpError(403, "Your PIN confirmation has expired. Please confirm your PIN again.");
      const r = await sql<{ r: SavedAccount }>`
        select public._save_bank_account(${userId}::uuid, ${bank.id}, ${account}, ${found.name}, ${found.provider}, ${recipient}) r`
        .execute(trx);
      return r.rows[0].r;
    });
  } catch (e) {
    // Messages raised by the account rules are meant for people.
    if ((e as { code?: string }).code === "P0001") throw new HttpError(400, (e as Error).message);
    throw e;
  }
}

// ------------------------------------------------------------------ bank list

const slugOf = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\b(plc|limited|ltd|of|nigeria|nig|bank|microfinance|mfb|mfbank)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

type ProviderBank = { name: string; code: string };

async function paystackBanks(svc: Services): Promise<ProviderBank[]> {
  const ps = svc.config.PAYSTACK_SECRET_KEY;
  if (!ps) return [];
  const out: ProviderBank[] = [];
  let next: string | null = null;
  for (let page = 0; page < 10; page++) {
    const url = `https://api.paystack.co/bank?country=nigeria&currency=NGN&perPage=100&use_cursor=true${next ? `&next=${encodeURIComponent(next)}` : ""}`;
    const r = await svc.fetch(url, { headers: { Authorization: `Bearer ${ps}` } });
    if (!r.ok) throw new Error(`Paystack bank list HTTP ${r.status}`);
    const j = (await r.json()) as { data?: { name: string; code: string; active?: boolean; is_deleted?: boolean; type?: string }[];
      meta?: { next?: string | null } };
    for (const b of j.data ?? []) {
      if (b.active === false || b.is_deleted) continue;
      if (b.type && b.type !== "nuban") continue;
      out.push({ name: b.name.trim(), code: String(b.code) });
    }
    next = j.meta?.next ?? null;
    if (!next) break;
  }
  return out;
}

async function flutterwaveBanks(svc: Services): Promise<ProviderBank[]> {
  const fw = svc.config.FLW_SECRET_KEY;
  if (!fw) return [];
  const r = await svc.fetch("https://api.flutterwave.com/v3/banks/NG", { headers: { Authorization: `Bearer ${fw}` } });
  if (!r.ok) throw new Error(`Flutterwave bank list HTTP ${r.status}`);
  const j = (await r.json()) as { data?: { name: string; code: string }[] };
  return (j.data ?? []).map((b) => ({ name: b.name.trim(), code: String(b.code) }));
}

/**
 * Refresh the bank list from both providers, matching a bank across them by code, then by name.
 * Codes are only added or replaced, never removed, so saved accounts keep working.
 */
export async function refreshBanks(svc: Services): Promise<{ banks: number }> {
  const [ps, fw] = await Promise.all([paystackBanks(svc), flutterwaveBanks(svc)]);
  if (ps.length === 0 && fw.length === 0) return { banks: 0 };
  type Row = { name: string; slug: string; paystack_code: string | null; flutterwave_code: string | null };
  const rows = new Map<string, Row>();
  for (const b of ps) rows.set(slugOf(b.name), { name: b.name, slug: slugOf(b.name), paystack_code: b.code, flutterwave_code: null });
  for (const b of fw) {
    const byCode = [...rows.values()].find((r) => r.paystack_code === b.code && !r.flutterwave_code);
    const row = byCode ?? rows.get(slugOf(b.name));
    if (row && !row.flutterwave_code) row.flutterwave_code = b.code;
    else if (!row) rows.set(slugOf(b.name), { name: b.name, slug: slugOf(b.name), paystack_code: null, flutterwave_code: b.code });
  }
  await asService(svc, async (trx) => {
    for (const r of rows.values()) {
      // Find the bank by either code or its name, then bring it up to date.
      const hit = await sql<{ id: number }>`
        select id from public.payout_banks
         where (paystack_code = ${r.paystack_code} and ${r.paystack_code}::text is not null)
            or (flutterwave_code = ${r.flutterwave_code} and ${r.flutterwave_code}::text is not null)
            or slug = ${r.slug}
         order by (paystack_code = ${r.paystack_code}) desc nulls last, id limit 1`.execute(trx);
      const id = hit.rows[0]?.id;
      if (id) {
        await sql`update public.payout_banks set
            paystack_code = coalesce(${r.paystack_code}, paystack_code),
            flutterwave_code = coalesce(${r.flutterwave_code}, flutterwave_code),
            active = true, updated_at = now()
          where id = ${id}
            and not exists (select 1 from public.payout_banks o where o.id <> ${id}
                             and ((o.paystack_code = ${r.paystack_code}) or (o.flutterwave_code = ${r.flutterwave_code})))`
          .execute(trx);
      } else {
        await sql`insert into public.payout_banks(name, slug, paystack_code, flutterwave_code)
          values (${r.name}, ${r.slug}, ${r.paystack_code}, ${r.flutterwave_code})
          on conflict do nothing`.execute(trx);
      }
    }
  });
  return { banks: rows.size };
}
