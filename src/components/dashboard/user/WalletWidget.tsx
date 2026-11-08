
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Plus, History } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getUserWallet, getWalletTransactions, WalletBalance, WalletTransaction } from "@/utils/walletUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AddMoneyToWalletModal from "./AddMoneyToWalletModal";
import { format } from "date-fns";

const WalletWidget: React.FC = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-32"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Wallet Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-green-600 mb-4">
            ₦{wallet?.balance?.toLocaleString() || '0'}
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={() => setShowAddMoney(true)}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Money
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowTransactions(true)}
            >
              <History className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

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
              <p className="text-gray-500 text-center py-8">No transactions yet</p>
            ) : (
              transactions.map((transaction) => (
                <div key={transaction.id} className="flex justify-between items-center p-3 border rounded">
                  <div>
                    <div className="font-medium">
                      {transaction.transaction_type === 'credit' ? '+' : '-'}₦{transaction.amount.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {transaction.description || transaction.transaction_source}
                    </div>
                    <div className="text-xs text-gray-400">
                      {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${
                    transaction.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
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
