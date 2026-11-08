
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { adminAdjustWallet } from "@/utils/walletUtils";
import { Loader2, Plus, Search, RefreshCw } from "lucide-react";

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
      console.log('Fetching users for wallet management...');
      
      // Fetch users with their wallet balances
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('role', 'user')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      console.log('Profiles fetched:', profilesData?.length);

      if (!profilesData || profilesData.length === 0) {
        setUsers([]);
        return;
      }

      // Fetch wallet balances separately
      const userIds = profilesData.map(p => p.id);
      const { data: walletsData, error: walletsError } = await supabase
        .from('wallets')
        .select('user_id, balance')
        .in('user_id', userIds);

      if (walletsError) {
        console.error('Error fetching wallets:', walletsError);
        // Continue without wallet data if there's an error
      }

      console.log('Wallets fetched:', walletsData?.length);

      // Combine users with their wallet balances
      const usersWithWallets = profilesData.map(profile => {
        const wallet = walletsData?.find(w => w.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email || '',
          full_name: profile.full_name || 'No Name',
          wallet_balance: wallet?.balance || 0
        };
      });

      console.log('Users with wallets:', usersWithWallets);
      setUsers(usersWithWallets);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ 
        title: "Error fetching users", 
        description: "Please try refreshing the page",
        variant: "destructive" 
      });
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
      const res = await adminAdjustWallet(selectedUser.id, amount, 'credit', creditDescription);
      const success = res.success;

      if (success) {
        toast({ title: "Wallet credited successfully!" });
        setSelectedUser(null);
        setCreditAmount("");
        setCreditDescription("");
        fetchUsers(); // Refresh the user list
      } else {
        toast({ title: "Failed to credit wallet", description: res.error, variant: "destructive" });
      }
    } catch (error) {
      console.error('Error crediting wallet:', error);
      toast({ title: "Error crediting wallet", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      user.full_name.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading users...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg sm:text-xl">Wallet Management</CardTitle>
              <CardDescription className="text-sm">Manage user wallet balances and credit wallets manually</CardDescription>
            </div>
            <Button
              onClick={fetchUsers}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="text-sm text-gray-500 mb-2">
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">
                  {searchTerm ? 'No users found matching search criteria' : 'No users found'}
                </p>
                {users.length === 0 && (
                  <Button onClick={fetchUsers} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Loading Users
                  </Button>
                )}
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm sm:text-base truncate">{user.full_name}</div>
                    <div className="text-xs sm:text-sm text-gray-500 truncate">{user.email}</div>
                    <div className="text-xs sm:text-sm font-medium text-green-600">
                      Balance: ₦{user.wallet_balance?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setSelectedUser(user)}
                    className="flex items-center gap-2 w-full sm:w-auto text-xs sm:text-sm"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                    Credit Wallet
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle>Credit Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">User</label>
              <div className="p-3 bg-gray-50 rounded">
                <div className="font-medium text-sm">{selectedUser?.full_name}</div>
                <div className="text-xs text-gray-500 break-all">{selectedUser?.email}</div>
                <div className="text-xs text-green-600">
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
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              onClick={handleCreditWallet}
              disabled={processing || !creditAmount || !creditDescription}
              className="w-full sm:w-auto"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                "Credit Wallet"
              )}
            </Button>
            <Button variant="outline" onClick={() => setSelectedUser(null)} className="w-full sm:w-auto">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWalletManagement;
