
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, ArrowUpCircle, ArrowDownCircle, Search } from "lucide-react";

interface AdminTransaction {
  id: string;
  user_email: string;
  user_name: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
  transaction_source: string;
  payment_gateway?: string;
  description?: string;
  created_at: string;
  status?: string;
}

const AdminTransactionHistory: React.FC = () => {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchAllTransactions();
  }, []);

  const fetchAllTransactions = async () => {
    try {
      setLoading(true);
      
      // Fetch wallet transactions with user details
      const { data: walletTransactions, error: walletError } = await supabase
        .from('wallet_transactions')
        .select(`
          *,
          profiles!inner(email, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (walletError) throw walletError;

      // Fetch payment records with user details
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          profiles!inner(email, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (paymentsError) throw paymentsError;

      // Combine and format transactions
      const allTransactions: AdminTransaction[] = [
        ...(walletTransactions || []).map(t => ({
          id: t.id,
          user_email: t.profiles.email,
          user_name: t.profiles.full_name || 'N/A',
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
          user_email: p.profiles.email,
          user_name: p.profiles.full_name || 'N/A',
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
      console.error('Error fetching admin transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(transaction =>
    transaction.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transaction.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transaction.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <CardTitle>All Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by user email, name, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No transactions found</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
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
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{transaction.user_name}</div>
                        <div className="text-sm text-gray-500">{transaction.user_email}</div>
                      </div>
                    </TableCell>
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
                    <TableCell className="max-w-48 truncate">{transaction.description || 'N/A'}</TableCell>
                    <TableCell>{getStatusBadge(transaction.status || 'completed')}</TableCell>
                    <TableCell>{format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminTransactionHistory;
