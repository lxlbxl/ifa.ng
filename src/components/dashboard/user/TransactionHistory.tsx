
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface Transaction {
  id: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
  transaction_source: string;
  payment_gateway?: string;
  description?: string;
  created_at: string;
  status?: string;
}

const TransactionHistory: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchTransactions();
    }
  }, [user?.id]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // Fetch wallet transactions
      const { data: walletTransactions, error: walletError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (walletError) throw walletError;

      // Fetch payment records for additional context
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Combine and format transactions
      const allTransactions: Transaction[] = [
        ...(walletTransactions || []).map(t => ({
          id: t.id,
          amount: t.amount,
          transaction_type: t.transaction_type as 'credit' | 'debit',
          transaction_source: t.transaction_source,
          payment_gateway: t.payment_gateway,
          description: t.description,
          created_at: t.created_at,
          status: 'completed'
        })),
        ...(payments || []).map(p => ({
          id: p.id,
          amount: p.amount,
          transaction_type: 'debit' as 'credit' | 'debit',
          transaction_source: 'session_payment',
          payment_gateway: p.selected_payment_method || p.payment_method,
          description: `Session payment - ${p.selected_payment_method || p.payment_method}`,
          created_at: p.created_at,
          status: p.status
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: 'credit' | 'debit') => {
    return type === 'credit' ? 
      <ArrowUpCircle className="h-4 w-4 text-green-600" /> : 
      <ArrowDownCircle className="h-4 w-4 text-red-600" />;
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
      paid: "default"
    };

    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No transactions found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTransactionIcon(transaction.transaction_type)}
                      <span className="capitalize">{transaction.transaction_type}</span>
                    </div>
                  </TableCell>
                  <TableCell className={transaction.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'}>
                    {transaction.transaction_type === 'credit' ? '+' : '-'}₦{transaction.amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="capitalize">{transaction.transaction_source.replace('_', ' ')}</TableCell>
                  <TableCell className="capitalize">{transaction.payment_gateway || 'N/A'}</TableCell>
                  <TableCell>{transaction.description || 'N/A'}</TableCell>
                  <TableCell>{getStatusBadge(transaction.status || 'completed')}</TableCell>
                  <TableCell>{format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionHistory;
