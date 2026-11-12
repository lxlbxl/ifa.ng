import { supabase } from "@/integrations/supabase/client";

// Wallet balances can only be READ from the browser. Every change (top-up, payment, refund,
// adjustment) happens on the server, so there is intentionally no credit/debit helper here.

export interface WalletBalance {
  id: string;
  balance: number;
  user_id: string;
}

export interface WalletTransaction {
  id: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
  transaction_source: string;
  payment_gateway?: string;
  description?: string;
  created_at: string;
}

export const getUserWallet = async (userId: string): Promise<WalletBalance | null> => {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    // A user with no wallet row yet simply has a zero balance; the row is created server-side on first credit.
    return data ?? { id: '', balance: 0, user_id: userId };
  } catch (error) {
    console.error('Error fetching wallet:', error);
    return null;
  }
};

export const getWalletTransactions = async (userId: string): Promise<WalletTransaction[]> => {
  try {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []).map(t => ({ ...t, transaction_type: t.transaction_type as 'credit' | 'debit' }));
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    return [];
  }
};

/** Admin only (enforced in the database): credit or debit a user's wallet with a mandatory reason. */
export const adminAdjustWallet = async (
  userId: string,
  amount: number,
  type: 'credit' | 'debit',
  description: string,
  provider?: 'paystack' | 'flutterwave'
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.rpc('admin_adjust_wallet' as any, {
    p_user_id: userId, p_amount: amount, p_type: type, p_description: description,
    p_provider: type === 'credit' ? provider ?? null : null,
  });
  return error ? { success: false, error: error.message } : { success: true };
};

export const hasInsufficientBalance = (walletBalance: number, amount: number): boolean => walletBalance < amount;
