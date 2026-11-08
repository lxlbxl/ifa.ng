
import { supabase } from "@/integrations/supabase/client";

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
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No wallet found, create one
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert({ user_id: userId })
          .select()
          .single();

        if (createError) throw createError;
        return newWallet;
      }
      throw error;
    }

    return data;
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
    
    // Ensure proper typing for transaction_type
    return (data || []).map(transaction => ({
      ...transaction,
      transaction_type: transaction.transaction_type as 'credit' | 'debit'
    }));
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    return [];
  }
};

export const addMoneyToWallet = async (
  userId: string,
  amount: number,
  paymentGateway: string,
  paymentReference: string,
  description?: string,
  idempotencyKey?: string
): Promise<{ success: boolean; transactionId?: string }> => {
  try {
    const { data, error } = await supabase.rpc('update_wallet_balance', {
      p_user_id: userId,
      p_amount: amount,
      p_transaction_type: 'credit',
      p_transaction_source: 'payment_gateway',
      p_payment_gateway: paymentGateway,
      p_payment_reference: paymentReference,
      p_description: description || `Added money via ${paymentGateway}`,
      p_idempotency_key: idempotencyKey
    });

    if (error) throw error;
    return { success: true, transactionId: data };
  } catch (error) {
    console.error('Error adding money to wallet:', error);
    return { success: false };
  }
};

export const deductFromWallet = async (
  userId: string,
  amount: number,
  sessionId?: bigint,
  description?: string,
  idempotencyKey?: string
): Promise<{ success: boolean; transactionId?: string }> => {
  try {
    const { data, error } = await supabase.rpc('update_wallet_balance', {
      p_user_id: userId,
      p_amount: amount,
      p_transaction_type: 'debit',
      p_transaction_source: 'session_payment',
      p_session_id: sessionId,
      p_description: description || 'Session payment',
      p_idempotency_key: idempotencyKey
    });

    if (error) throw error;
    return { success: true, transactionId: data };
  } catch (error) {
    console.error('Error deducting from wallet:', error);
    return { success: false };
  }
};

export const adminCreditWallet = async (
  userId: string,
  amount: number,
  description: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.rpc('update_wallet_balance', {
      p_user_id: userId,
      p_amount: amount,
      p_transaction_type: 'credit',
      p_transaction_source: 'admin_adjustment',
      p_description: description
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error crediting wallet (admin):', error);
    return false;
  }
};

export const hasInsufficientBalance = (walletBalance: number, amount: number): boolean => {
  return walletBalance < amount;
};

/**
 * Rollback a wallet transaction
 * @param transactionId - The ID of the transaction to rollback
 * @returns Promise<boolean> - Success status
 */
export const rollbackWalletTransaction = async (
  transactionId: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.rpc('rollback_wallet_transaction', {
      p_transaction_id: transactionId
    });

    if (error) {
      console.error('Error rolling back transaction:', error);
      throw error;
    }

    console.log(`✅ Transaction ${transactionId} rolled back successfully`);
    return true;
  } catch (error) {
    console.error('❌ Failed to rollback transaction:', error);
    return false;
  }
};
