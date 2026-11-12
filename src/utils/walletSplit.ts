/**
 * How a price splits between the client's wallet and a card payment.
 * Mirrors public._wallet_share in the database, which has the final say:
 * the wallet pays what it can, the card pays the rest (never less than the card minimum).
 */
export interface WalletSplit {
  /** The wallet covers the whole price: pay from the wallet alone. */
  covered: boolean;
  /** Taken from the wallet when the card payment is confirmed. */
  wallet: number;
  /** Charged by Paystack or Flutterwave. */
  card: number;
}

export function walletSplit(balance: number, price: number, minCard = 100): WalletSplit {
  const bal = Math.max(0, Number(balance) || 0);
  if (bal >= price) return { covered: true, wallet: price, card: 0 };
  const wallet = Math.max(0, Math.min(bal, price - minCard));
  return { covered: false, wallet, card: price - wallet };
}
