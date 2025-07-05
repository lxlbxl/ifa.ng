import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface BankDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface BankDetail {
  id?: string;
  babalawo_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  created_at?: string;
  updated_at?: string;
}

const NIGERIAN_BANKS = [
  { name: 'Access Bank', code: '044' },
  { name: 'Citibank', code: '023' },
  { name: 'Diamond Bank', code: '063' },
  { name: 'Ecobank', code: '050' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'First Bank', code: '011' },
  { name: 'First City Monument Bank', code: '214' },
  { name: 'Guaranty Trust Bank', code: '058' },
  { name: 'Heritage Bank', code: '030' },
  { name: 'Jaiz Bank', code: '301' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Providus Bank', code: '101' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Standard Chartered Bank', code: '068' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Suntrust Bank', code: '100' },
  { name: 'Union Bank', code: '032' },
  { name: 'United Bank for Africa', code: '033' },
  { name: 'Unity Bank', code: '215' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Zenith Bank', code: '057' },
];

const BankDetailsModal: React.FC<BankDetailsModalProps> = ({ 
  open, 
  onOpenChange,
  onSuccess
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bankDetails, setBankDetails] = useState<BankDetail>({
    babalawo_id: '',
    bank_name: '',
    account_number: '',
    account_name: '',
  });
  
  useEffect(() => {
    if (open && user?.id) {
      fetchBankDetails();
    }
  }, [open, user?.id]);
  
  const fetchBankDetails = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    
    try {
      // First, get the babalawo_id for the current user
      const { data: babalawoData, error: babalawoError } = await supabase
        .from('babalawos')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (babalawoError) throw babalawoError;
      
      if (!babalawoData?.id) {
        throw new Error('Babalawo profile not found');
      }
      
      // Then, fetch the bank details
      const { data, error } = await supabase
        .from('babalawo_bank_details')
        .select('*')
        .eq('babalawo_id', babalawoData.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setBankDetails({
          babalawo_id: babalawoData.id,
          bank_name: data.bank_name || '',
          account_number: data.account_number || '',
          account_name: data.account_name || '',
        });
      } else {
        setBankDetails({
          babalawo_id: babalawoData.id,
          bank_name: '',
          account_number: '',
          account_name: '',
        });
      }
    } catch (err) {
      console.error('Error fetching bank details:', err);
      toast({
        title: 'Error',
        description: 'Failed to load bank details',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bankDetails.babalawo_id || !bankDetails.bank_name || !bankDetails.account_number || !bankDetails.account_name) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all fields',
        variant: 'destructive'
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('babalawo_bank_details')
        .upsert(
          {
            babalawo_id: bankDetails.babalawo_id,
            bank_name: bankDetails.bank_name,
            account_number: bankDetails.account_number,
            account_name: bankDetails.account_name,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'babalawo_id' }
        );
      
      if (error) throw error;
      
      toast({
        title: 'Bank details saved',
        description: 'Your bank details have been updated successfully'
      });
      
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving bank details:', err);
      toast({
        title: 'Error',
        description: 'Failed to save bank details',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Bank Account Details</DialogTitle>
          <DialogDescription>
            Enter your bank account details for receiving payments.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Select
                  value={bankDetails.bank_name}
                  onValueChange={(value) => setBankDetails({ ...bankDetails, bank_name: value })}
                >
                  <SelectTrigger id="bank_name">
                    <SelectValue placeholder="Select a bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {NIGERIAN_BANKS.map((bank) => (
                      <SelectItem key={bank.code} value={bank.name}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  value={bankDetails.account_number}
                  onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })}
                  placeholder="Enter your account number"
                  maxLength={10}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="account_name">Account Name</Label>
                <Input
                  id="account_name"
                  value={bankDetails.account_name}
                  onChange={(e) => setBankDetails({ ...bankDetails, account_name: e.target.value })}
                  placeholder="Enter account holder's name"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Details'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BankDetailsModal;
