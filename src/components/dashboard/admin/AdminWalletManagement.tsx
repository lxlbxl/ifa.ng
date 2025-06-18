
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { adminCreditWallet } from "@/utils/walletUtils";
import { Loader2, Plus, Search } from "lucide-react";

interface User {
  id: string;
  email: string;
  full_name: string;
  wallet_balance?: number;
}

const AdminWalletManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDescription, setCreditDescription] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch users with their wallet balances
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          wallets!inner(balance)
        `)
        .eq('role', 'user');

      if (profilesError) throw profilesError;

      const usersWithWallets = profilesData.map(profile => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        wallet_balance: profile.wallets?.[0]?.balance || 0
      }));

      setUsers(usersWithWallets);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ title: "Error fetching users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreditWallet = async () => {
    if (!selectedUser || !creditAmount || !creditDescription) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }

    const amount = parseFloat(creditAmount);
    if (amount <= 0) {
      toast({ title: "Amount must be greater than 0", variant: "destructive" });
      return;
    }

    setProcessing(true);
    try {
      const success = await adminCreditWallet(selectedUser.id, amount, creditDescription);
      
      if (success) {
        toast({ title: "Wallet credited successfully!" });
        setSelectedUser(null);
        setCreditAmount("");
        setCreditDescription("");
        fetchUsers(); // Refresh the user list
      } else {
        toast({ title: "Failed to credit wallet", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error crediting wallet:', error);
      toast({ title: "Error crediting wallet", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Wallet Management</CardTitle>
          <CardDescription>Manage user wallet balances and credit wallets manually</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredUsers.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No users found</p>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">{user.full_name || 'No Name'}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    <div className="text-sm font-medium text-green-600">
                      Balance: ₦{user.wallet_balance?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setSelectedUser(user)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Credit Wallet
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credit Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">User</label>
              <div className="p-3 bg-gray-50 rounded">
                <div className="font-medium">{selectedUser?.full_name}</div>
                <div className="text-sm text-gray-500">{selectedUser?.email}</div>
                <div className="text-sm text-green-600">
                  Current Balance: ₦{selectedUser?.wallet_balance?.toLocaleString() || '0'}
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Credit Amount (₦)</label>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="Enter amount to credit"
                min="1"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Input
                value={creditDescription}
                onChange={(e) => setCreditDescription(e.target.value)}
                placeholder="Reason for crediting wallet"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              onClick={handleCreditWallet}
              disabled={processing || !creditAmount || !creditDescription}
            >
              {processing ? "Processing..." : "Credit Wallet"}
            </Button>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWalletManagement;
