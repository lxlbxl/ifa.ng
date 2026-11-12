import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/integrations/api/config';
import { useAuth } from '@/hooks/useAuth';

export type Currency = 'NGN' | 'USD';

export type Pricing = {
  currency: Currency;
  usd_ngn_rate: number;
  ebo_usd_multiplier: number;
  min_wallet_topup: number;
  wallet_currency: Currency | null;
};

const NAIRA: Pricing = { currency: 'NGN', usd_ngn_rate: 1600, ebo_usd_multiplier: 1, min_wallet_topup: 1000, wallet_currency: null };

/**
 * Which currency this visitor sees prices in. The server decides (country of the visitor's IP,
 * then phone number, then any admin override), so it can't be changed from the browser.
 * Nigeria: naira. Everyone else: US dollars.
 */
export function usePricing(): Pricing & { isUsd: boolean; loading: boolean } {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['pricing', user?.id ?? null],
    staleTime: 5 * 60_000,
    queryFn: () => apiFetch<Pricing>('/v1/pricing'),
    retry: 1,
  });
  const p = data ?? NAIRA;
  return { ...p, isUsd: p.currency === 'USD', loading: isLoading };
}

/** "₦15,000" or "$40" (cents shown only when there are some). */
export function formatMoney(amount: number, currency: Currency = 'NGN'): string {
  const n = Number(amount) || 0;
  if (currency === 'USD') {
    const cents = Math.round(n * 100) % 100 !== 0;
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })}`;
  }
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

/** An Ebo's naira amount in dollars, the same way the server charges it (rounded up to the cent). */
export function eboUsd(amountDue: number, p: Pick<Pricing, 'usd_ngn_rate' | 'ebo_usd_multiplier'>): number {
  return Math.ceil((amountDue / p.usd_ngn_rate) * p.ebo_usd_multiplier * 100) / 100;
}

type PricedBabalawo = {
  hourly_rate?: number | string | null;
  instant_price?: number | null;
  usd_price?: number | null;
  usd_instant_price?: number | null;
};

/**
 * What this visitor pays for a consultation with this Babalawo, in their currency.
 * Naira: the Babalawo's own rate. Dollars: the admin-set diaspora price (or the derived one).
 */
export function babalawoPrice(b: PricedBabalawo, p: Pick<Pricing, 'currency'>, instant = false): { amount: number; currency: Currency } {
  if (p.currency === 'USD') {
    const usd = Number((instant ? b.usd_instant_price : null) ?? b.usd_price);
    if (Number.isFinite(usd) && usd > 0) return { amount: usd, currency: 'USD' };
  }
  const ngn = Number((instant ? b.instant_price : null) ?? b.hourly_rate);
  return { amount: Number.isFinite(ngn) && ngn > 0 ? ngn : 15000, currency: 'NGN' };
}
