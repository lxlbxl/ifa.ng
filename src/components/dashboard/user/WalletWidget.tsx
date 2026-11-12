
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, Plus, History } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatMoney, usePricing } from "@/hooks/usePricing";
import { getUserWallet, getWalletTransactions, WalletBalance, WalletTransaction } from "@/utils/walletUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AddMoneyToWalletModal from "./AddMoneyToWalletModal";
import { format } from "date-fns";

const WalletWidget: React.FC = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const pricing = usePricing();
  const walletCurrency = wallet?.currency ?? pricing.wallet_currency ?? pricing.currency;
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchWalletData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const [walletData, transactionsData] = await Promise.all([
        getUserWallet(user.id),
        getWalletTransactions(user.id)
      ]);
      
      setWallet(walletData);
      setTransactions(transactionsData);
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWalletData();
  }, [user?.id]);

  const handleAddMoneySuccess = () => {
    fetchWalletData(); // Refresh wallet data
  };

  return (
    <>
      <div className="flex h-full flex-col gap-2 rounded-panel bg-[#b9c4f2] p-5 text-ink">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow opacity-75">Wallet</span>
          <Wallet className="h-5 w-5 opacity-80" />
        </div>
        <span className="font-display text-[clamp(28px,3vw,40px)] font-extrabold leading-none tracking-[-0.03em]">
          {loading ? <span className="inline-block h-9 w-32 animate-pulse rounded-field bg-ink/10 align-middle" /> : formatMoney(Number(wallet?.balance ?? 0), walletCurrency)}
        </span>
        <div className="mt-auto flex gap-2 pt-2">
          <Button size="sm" onClick={() => setShowAddMoney(true)} className="flex-1">
            <Plus />Add money
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowTransactions(true)} aria-label="Wallet history" className="px-3">
            <History />
          </Button>
        </div>
      </div>

      <AddMoneyToWalletModal
        open={showAddMoney}
        onOpenChange={setShowAddMoney}
        onSuccess={handleAddMoneySuccess}
      />

      <Dialog open={showTransactions} onOpenChange={setShowTransactions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Wallet Transactions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No transactions yet</p>
            ) : (
              transactions.map((transaction) => (
                <div key={transaction.id} className="flex justify-between items-center rounded-field border border-line bg-paper p-3">
                  <div>
                    <div className="font-medium">
                      {transaction.transaction_type === 'credit' ? '+' : '-'}{formatMoney(transaction.amount, transaction.currency ?? walletCurrency)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {transaction.description || transaction.transaction_source}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${
                    transaction.transaction_type === 'credit' ? 'text-green-700' : 'text-coral'
                  }`}>
                    {transaction.transaction_type === 'credit' ? 'Credit' : 'Debit'}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WalletWidget;
