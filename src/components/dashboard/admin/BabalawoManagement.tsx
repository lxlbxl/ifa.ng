import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Search, Star, Users, Award, Settings, Check, X, Clock, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useReviewBabalawo } from "@/hooks/useAdminActions";
import { useAdminBabalawos } from "@/hooks/useAdminBabalawos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import BabalawoCommissionModal from "./BabalawoCommissionModal";

const BabalawoManagement: React.FC<{ onOpen?: (id: string) => void }> = ({ onOpen }) => {
  const { data: babalawos, isLoading, error, refetch } = useAdminBabalawos();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'suspended'>('pending');
  const [updatingFeatured, setUpdatingFeatured] = useState<string | null>(null);
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [selectedBabalawo, setSelectedBabalawo] = useState<{ id: string; name: string } | null>(null);

  const filteredBabalawos = babalawos?.filter(babalawo =>
    (statusFilter === 'all' || babalawo.review_status === statusFilter) && (
    babalawo.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    babalawo.specialties?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())))
  ) || [];
  const pendingCount = babalawos?.filter(b => b.review_status === 'pending').length || 0;

  const updateFeaturedStatus = async (babalawoId: string, isFeatured: boolean) => {
    setUpdatingFeatured(babalawoId);
    try {
      const { error } = await supabase
        .from('babalawos')
        .update({ is_featured: isFeatured })
        .eq('user_id', babalawoId);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `Babalawo ${isFeatured ? 'marked as featured' : 'removed from featured'}`,
      });

      refetch();
    } catch (error) {
      console.error('Error updating featured status:', error);
      toast({
        title: "Error",
        description: "Failed to update featured status",
        variant: "destructive",
      });
    } finally {
      setUpdatingFeatured(null);
    }
  };

  const review = useReviewBabalawo();
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Babalawo Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg animate-pulse">
                <div className="h-12 w-12 bg-gray-300 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-1/4"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Babalawo Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-red-500">
            Error loading babalawos. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Babalawo Management
        </CardTitle>
        <p className="text-sm text-gray-600">
          Manage Babalawo verification, featured status, and profiles
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name or specialty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['pending','approved','rejected','suspended','all'] as const).map(f => (
            <Button key={f} size="sm" variant={statusFilter === f ? 'default' : 'outline'} onClick={() => setStatusFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Button>
          ))}
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Total Babalawos</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{babalawos?.length || 0}</p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-green-600" />
              <span className="font-medium">Featured</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {babalawos?.filter(b => b.is_featured).length || 0}
            </p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-purple-600" />
              <span className="font-medium">Verified</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {babalawos?.filter(b => b.is_verified).length || 0}
            </p>
          </div>
        </div>

        {/* Babalawos List */}
        <div className="space-y-4">
          {filteredBabalawos.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No babalawos found</p>
          ) : (
            filteredBabalawos.map((babalawo) => (
              <div key={babalawo.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <button type="button" onClick={() => onOpen?.(babalawo.id)} aria-label={`Open ${babalawo.full_name || 'Babalawo'}'s record`}
                    className="flex items-center gap-4 rounded-field text-left hover:opacity-80">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={babalawo.avatar_url} />
                      <AvatarFallback>
                        {babalawo.full_name?.charAt(0) || 'B'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold">{babalawo.full_name || 'Unnamed'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {babalawo.is_verified && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Verified
                          </Badge>
                        )}
                        {babalawo.is_featured && (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                            Featured
                          </Badge>
                        )}
                        <Badge variant="outline" className={
                          babalawo.current_status === 'online' ? 'border-green-500 text-green-700' :
                          babalawo.current_status === 'busy' ? 'border-yellow-500 text-yellow-700' :
                          'border-gray-500 text-gray-700'
                        }>
                          {babalawo.current_status || 'offline'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          {babalawo.rating?.toFixed(1) || '0.0'}
                        </span>
                        <span>{babalawo.total_sessions || 0} sessions</span>
                        <span>₦{babalawo.hourly_rate?.toLocaleString() || '0'}/hr</span>
                      </div>
                      
                      {babalawo.specialties && babalawo.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {babalawo.specialties.slice(0, 3).map((specialty, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {specialty}
                            </Badge>
                          ))}
                          {babalawo.specialties.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{babalawo.specialties.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 flex-none text-muted-foreground" />
                  </button>
                </div>

                {/* Action Controls */}
                <div className="flex flex-wrap items-center gap-4 pt-4 border-t">
                  <Badge variant="outline" className="capitalize">
                    {babalawo.review_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                    {babalawo.review_status}
                  </Badge>
                  {babalawo.review_status !== 'approved' && (
                    <Button size="sm" disabled={review.isPending}
                      onClick={() => review.mutate({ userId: babalawo.id, status: 'approved' })}>
                      <Check className="h-4 w-4 mr-1" />Approve
                    </Button>
                  )}
                  {babalawo.review_status !== 'rejected' && (
                    <Button size="sm" variant="outline" className="text-red-600" disabled={review.isPending}
                      onClick={() => { setRejectReason(""); setRejectTarget({ id: babalawo.id, name: babalawo.full_name || 'Unnamed' }); }}>
                      <X className="h-4 w-4 mr-1" />Reject
                    </Button>
                  )}
                  {babalawo.review_status === 'approved' && (
                    <Button size="sm" variant="outline" disabled={review.isPending}
                      onClick={() => review.mutate({ userId: babalawo.id, status: 'suspended', notes: 'Suspended by admin' })}>
                      Suspend
                    </Button>
                  )}
                  {babalawo.review_notes && babalawo.review_status !== 'approved' && (
                    <span className="text-xs text-gray-500 w-full">Note: {babalawo.review_notes}</span>
                  )}

                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Featured:</label>
                    <Switch
                      checked={babalawo.is_featured}
                      onCheckedChange={(checked) => updateFeaturedStatus(babalawo.id, checked)}
                      disabled={updatingFeatured === babalawo.id}
                    />
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => {
                      setSelectedBabalawo({
                        id: babalawo.id,
                        name: babalawo.full_name || 'Unnamed'
                      });
                      setCommissionModalOpen(true);
                    }}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Manage Commission
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget?.name}?</DialogTitle>
            <DialogDescription>The reason is sent to the Babalawo so they can fix their profile.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectReason.trim()}
              onClick={() => {
                if (!rejectTarget) return;
                review.mutate({ userId: rejectTarget.id, status: 'rejected', notes: rejectReason.trim() });
                setRejectTarget(null);
              }}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedBabalawo && (
        <BabalawoCommissionModal
          open={commissionModalOpen}
          onOpenChange={setCommissionModalOpen}
          babalawoId={selectedBabalawo.id}
          babalawoName={selectedBabalawo.name}
          onUpdate={refetch}
        />
      )}
    </Card>
  );
};

export default BabalawoManagement;
