import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { errorService } from '@/services/errorService';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  approved_at: string | null;
  processed_at: string | null;
  rejection_reason: string | null;
  processor_reference: string | null;
  user_id: string;
  bank_details_id: string;
  profiles: {
    full_name: string | null;
  } | null;
  babalawo_bank_details: {
    bank_name: string;
    account_name: string;
    account_number: string;
  } | null;
}

const fetchWithdrawalRequests = async (filters: any): Promise<WithdrawalRequest[]> => {
  let query = supabase.from('withdrawal_requests').select(`
    id,
    amount,
    status,
    created_at,
    approved_at,
    processed_at,
    rejection_reason,
    processor_reference,
    user_id,
    bank_details_id,
    profiles(full_name),
    babalawo_bank_details(bank_name, account_name, account_number)
  `).order('created_at', { ascending: false });

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.search_term) {
    // This requires a full-text search index or a more complex RPC function
    // For now, we'll filter client-side or rely on exact matches if possible
    // A better solution would be to create a Supabase function for searching profiles
  }

  const { data, error } = await query;
  if (error) {
    throw errorService.handleError(error, 'FETCH_WITHDRAWAL_REQUESTS');
  }
  return data as WithdrawalRequest[];
};

const updateWithdrawalStatus = async ({ id, status, processor_reference, rejection_reason }: { id: string; status: string; processor_reference?: string; rejection_reason?: string }) => {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .update({ 
      status,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
      processed_at: status === 'completed' ? new Date().toISOString() : null,
      processor_reference: processor_reference || null,
      rejection_reason: rejection_reason || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw errorService.handleError(error, 'UPDATE_WITHDRAWAL_STATUS');
  }
  return data;
};

const AdminWithdrawalManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ status: 'all', search_term: '' });
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [processRef, setProcessRef] = useState('');
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

  const { data: requests, isLoading, isError, error } = useQuery<WithdrawalRequest[], Error>({
    queryKey: ['withdrawalRequests', filters],
    queryFn: () => fetchWithdrawalRequests(filters),
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: updateWithdrawalStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawalRequests'] });
      toast.success('Withdrawal request updated successfully!');
      setCurrentRequestId(null);
      setRejectReason('');
      setProcessRef('');
    },
    onError: (err: any) => {
      errorService.showErrorToast(err);
    },
  });

  const handleStatusChange = (status: string) => {
    setFilters(prev => ({ ...prev, status }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search_term: e.target.value }));
  };

  const handleApprove = (id: string) => {
    mutation.mutate({ id, status: 'approved' });
  };

  const handleProcess = (id: string) => {
    setCurrentRequestId(id);
  };

  const handleReject = (id: string) => {
    setCurrentRequestId(id);
  };

  const confirmProcess = () => {
    if (currentRequestId && processRef) {
      mutation.mutate({ id: currentRequestId, status: 'completed', processor_reference: processRef });
    } else {
      toast.error('Please provide a processor reference.');
    }
  };

  const confirmReject = () => {
    if (currentRequestId && rejectReason) {
      mutation.mutate({ id: currentRequestId, status: 'rejected', rejection_reason: rejectReason });
    } else {
      toast.error('Please provide a rejection reason.');
    }
  };

  const handleSelectRequest = (id: string) => {
    setSelectedRequests(prev => 
      prev.includes(id) ? prev.filter(reqId => reqId !== id) : [...prev, id]
    );
  };

  const handleBatchProcess = () => {
    if (selectedRequests.length === 0) {
      toast.error('No requests selected for batch processing.');
      return;
    }
    // This would ideally call a new RPC function for batch processing
    // For now, we'll simulate by processing each one individually
    selectedRequests.forEach(id => {
      mutation.mutate({ id, status: 'completed', processor_reference: 'BATCH_PROCESSED' });
    });
    setSelectedRequests([]);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'approved': return 'default';
      case 'completed': return 'success';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading withdrawal requests...</div>;
  }

  if (isError) {
    return <div className="text-center py-8 text-red-500">Error: {error?.message || 'Failed to load requests'}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdrawal Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <Input
            placeholder="Search by Babalawo name..."
            value={filters.search_term}
            onChange={handleSearchChange}
            className="max-w-sm"
          />
          <Select value={filters.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleBatchProcess} disabled={selectedRequests.length === 0}>
            Batch Process ({selectedRequests.length})
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <input
                  type="checkbox"
                  checked={selectedRequests.length === requests.length && requests.length > 0}
                  onChange={() => 
                    setSelectedRequests(selectedRequests.length === requests.length ? [] : requests.map(r => r.id))
                  }
                />
              </TableHead>
              <TableHead>Babalawo</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Bank Details</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested On</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500">
                  No withdrawal requests found.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedRequests.includes(request.id)}
                      onChange={() => handleSelectRequest(request.id)}
                      disabled={request.status !== 'pending' && request.status !== 'approved'}
                    />
                  </TableCell>
                  <TableCell>{request.profiles?.full_name || 'N/A'}</TableCell>
                  <TableCell>₦{request.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    {request.babalawo_bank_details ? (
                      <>
                        {request.babalawo_bank_details.bank_name} ({request.babalawo_bank_details.account_name})<br />
                        {request.babalawo_bank_details.account_number}
                      </>
                    ) : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(request.status)}>
                      {request.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(request.created_at), 'PPP')}</TableCell>
                  <TableCell className="space-x-2">
                    {request.status === 'pending' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleApprove(request.id)}>Approve</Button>
                        <Dialog open={currentRequestId === request.id && rejectReason === ''} onOpenChange={(open) => !open && setCurrentRequestId(null)}>
                          <DialogTrigger asChild>
                            <Button variant="destructive" size="sm" onClick={() => handleReject(request.id)}>Reject</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reject Withdrawal Request</DialogTitle>
                              <DialogDescription>
                                Please provide a reason for rejecting this withdrawal request.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="rejectReason" className="text-right">
                                  Reason
                                </Label>
                                <Textarea
                                  id="rejectReason"
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  className="col-span-3"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setCurrentRequestId(null)}>Cancel</Button>
                              <Button onClick={confirmReject}>Confirm Reject</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                    {request.status === 'approved' && (
                      <Dialog open={currentRequestId === request.id && processRef === ''} onOpenChange={(open) => !open && setCurrentRequestId(null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" onClick={() => handleProcess(request.id)}>Process</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Process Withdrawal Request</DialogTitle>
                            <DialogDescription>
                              Enter the processor reference for this withdrawal.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="processRef" className="text-right">
                                Reference
                              </Label>
                              <Input
                                id="processRef"
                                value={processRef}
                                onChange={(e) => setProcessRef(e.target.value)}
                                className="col-span-3"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setCurrentRequestId(null)}>Cancel</Button>
                            <Button onClick={confirmProcess}>Confirm Process</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default AdminWithdrawalManagement;
