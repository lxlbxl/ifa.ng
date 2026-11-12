import { sql } from "kysely";
import { asService, type Services } from "./context.js";

/**
 * The visitor's country, for prices. Only the header named in GEO_COUNTRY_HEADER is trusted
 * (set it to cf-ipcountry when the site is behind Cloudflare's proxy, which overwrites that
 * header). Any other header could be typed by the visitor to get naira prices, so it is ignored.
 * Without a trusted header the country is unknown and the phone number decides.
 */
export function trustedCountry(req: Request, svc: Pick<Services, "config">): string | null {
  const name = svc.config.GEO_COUNTRY_HEADER?.trim();
  if (!name) return null;
  const v = req.headers.get(name)?.trim().toUpperCase();
  return v && /^[A-Z]{2}$/.test(v) && v !== "XX" && v !== "T1" ? v : null;
}

export type Pricing = {
  currency: "NGN" | "USD";
  usd_ngn_rate: number;
  ebo_usd_multiplier: number;
  min_wallet_topup: number;
  wallet_currency: "NGN" | "USD" | null;
};

/** Which currency this visitor (signed in or not) sees prices in, and what the app needs to show them. */
export async function pricingFor(svc: Services, userId: string | null, country: string | null): Promise<Pricing> {
  const r = await asService(svc, (trx) =>
    sql<{ p: Pricing }>`select public.pricing_for(${userId}::uuid, ${country}) p`.execute(trx));
  const p = r.rows[0].p;
  return { ...p, usd_ngn_rate: Number(p.usd_ngn_rate), ebo_usd_multiplier: Number(p.ebo_usd_multiplier),
           min_wallet_topup: Number(p.min_wallet_topup) };
}
