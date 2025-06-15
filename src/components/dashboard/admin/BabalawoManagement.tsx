
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Pencil, Calendar, Star, Clock, CheckCircle, XCircle, Search, Filter, MoreHorizontal, DollarSign, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Fetch all babalawos
const fetchBabalawos = async () => {
  const { data, error } = await supabase.from("babalawos").select("id, hourly_rate, is_active, specialties, verification_status, rating, total_sessions");
  if (error) throw error;
  // Get profile info for each
  const ids = data.map((b: any) => b.id);
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url, email").in("id", ids);
  const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
  return data.map((b: any) => ({
    ...b,
    ...profileMap[b.id],
  }));
};

// Fetch availability slots for a babalawo
const fetchAvailability = async (babalawoId: string) => {
  const { data, error } = await supabase
    .from("availability")
    .select("*")
    .eq("babalawo_id", babalawoId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data;
};

const BabalawoManagement = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-babalawos"],
    queryFn: fetchBabalawos,
  });

  // State for search and filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal State
  const [editBabalawo, setEditBabalawo] = useState<any>(null);
  const [availBabalawo, setAvailBabalawo] = useState<any>(null);

  // Edit Rate and Save
  const [rate, setRate] = useState<string>("");
  const editMutation = useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: string }) => {
      const { error } = await supabase.from("babalawos").update({ hourly_rate: Number(rate) }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-babalawos"] });
      setEditBabalawo(null);
    },
  });

  // Fetch and Manage Availability Dialog
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  React.useEffect(() => {
    if (availBabalawo) {
      setLoadingSlots(true);
      fetchAvailability(availBabalawo.id)
        .then(setSlots)
        .finally(() => setLoadingSlots(false));
    }
  }, [availBabalawo]);

  // Add/Edit/Remove slot
  const addSlot = () => setSlots(s => [...s, { day_of_week: 1, start_time: "09:00", end_time: "10:00", is_available: true }]);
  const updateSlot = (i: number, key: string, value: any) =>
    setSlots(s => s.map((slot, idx) => (idx === i ? { ...slot, [key]: value } : slot)));
  const removeSlot = (idx: number) => setSlots(s => s.filter((_, i) => i !== idx));
  const saveSlots = async () => {
    // Remove old & add new
    await supabase.from("availability").delete().eq("babalawo_id", availBabalawo.id);
    await supabase.from("availability").insert(slots.map(s => ({ ...s, babalawo_id: availBabalawo.id })));
    queryClient.invalidateQueries({ queryKey: ["admin-babalawos"] });
    setAvailBabalawo(null);
  };

  // Filter babalawos
  const filteredBabalawos = data?.filter(baba => {
    const matchesSearch = baba.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         baba.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && baba.is_active) ||
                         (statusFilter === "inactive" && !baba.is_active) ||
                         (statusFilter === "verified" && baba.verification_status === "approved") ||
                         (statusFilter === "pending" && baba.verification_status !== "approved");
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-purple-600"/>
          <p className="text-gray-600">Loading babalawos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold text-gray-900">Babalawo Management</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Manage babalawo profiles, rates, and availability</p>
            </div>
            <Badge variant="secondary" className="w-fit">
              {filteredBabalawos?.length || 0} Total Babalawos
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search babalawos by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-gray-200 focus:border-purple-500"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] border-gray-200">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Babalawos Grid */}
      {filteredBabalawos && filteredBabalawos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBabalawos.map((baba: any) => (
            <Card key={baba.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-gray-100">
                      <AvatarImage src={baba.avatar_url || ''} />
                      <AvatarFallback className="bg-purple-100 text-purple-600 font-semibold">
                        {baba.full_name?.[0]?.toUpperCase() || 'B'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-gray-900">{baba.full_name || 'Unnamed Babalawo'}</h3>
                      <p className="text-sm text-gray-500">{baba.email}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        onClick={() => { setEditBabalawo(baba); setRate((baba.hourly_rate || 0).toString()); }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Rate
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        onClick={() => setAvailBabalawo(baba)}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Manage Schedule
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Session Rate</span>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-gray-900">₦{baba.hourly_rate?.toLocaleString() || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Rating</span>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="font-semibold text-gray-900">{baba.rating || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Sessions</span>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-gray-900">{baba.total_sessions || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex gap-2">
                      <Badge variant={baba.is_active ? "default" : "secondary"} className="text-xs">
                        {baba.is_active ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </>
                        )}
                      </Badge>
                      <Badge 
                        variant={baba.verification_status === "approved" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {baba.verification_status === "approved" ? "Verified" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No babalawos found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Rate Modal */}
      <Dialog open={!!editBabalawo} onOpenChange={() => setEditBabalawo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Session Rate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Session Rate (₦)
              </label>
              <Input 
                value={rate} 
                onChange={e => setRate(e.target.value)} 
                type="number" 
                min={100}
                placeholder="Enter session rate"
                className="border-gray-200"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditBabalawo(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => editMutation.mutate({ id: editBabalawo.id, rate })} 
              disabled={editMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {editMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Availability Modal */}
      <Dialog open={!!availBabalawo} onOpenChange={() => setAvailBabalawo(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Weekly Availability</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {loadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin h-6 w-6 text-purple-600"/>
                <span className="ml-2 text-gray-600">Loading availability...</span>
              </div>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={addSlot}
                  className="w-full border-dashed border-gray-300 text-gray-600 hover:border-purple-500 hover:text-purple-600"
                >
                  + Add Time Slot
                </Button>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {slots.map((slot, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <select
                        value={slot.day_of_week}
                        onChange={e => updateSlot(i, "day_of_week", Number(e.target.value))}
                        className="border border-gray-200 rounded px-3 py-2 text-sm"
                      >
                        {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d, idx) => (
                          <option key={idx} value={idx}>{d}</option>
                        ))}
                      </select>
                      <Input 
                        type="time" 
                        value={slot.start_time} 
                        onChange={e => updateSlot(i, "start_time", e.target.value)} 
                        className="w-32 border-gray-200"
                      />
                      <span className="text-gray-500">to</span>
                      <Input 
                        type="time" 
                        value={slot.end_time} 
                        onChange={e => updateSlot(i, "end_time", e.target.value)} 
                        className="w-32 border-gray-200"
                      />
                      <label className="flex items-center text-sm">
                        <input 
                          type="checkbox" 
                          checked={slot.is_available} 
                          onChange={e => updateSlot(i, "is_available", e.target.checked)} 
                          className="mr-2"
                        />
                        Available
                      </label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeSlot(i)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAvailBabalawo(null)}>
              Cancel
            </Button>
            <Button 
              onClick={saveSlots} 
              disabled={loadingSlots}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loadingSlots ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Schedule'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BabalawoManagement;
