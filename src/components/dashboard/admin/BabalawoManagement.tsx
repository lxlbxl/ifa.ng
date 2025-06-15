
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// Fetch all babalawos
const fetchBabalawos = async () => {
  const { data, error } = await supabase.from("babalawos").select("id, hourly_rate, is_active, specialties, verification_status");
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

// Main Management Table
const BabalawoManagement = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-babalawos"],
    queryFn: fetchBabalawos,
  });

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

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8"/></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Babalawo Management</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rate/Session</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div>{b.full_name || "N/A"}</div>
                </TableCell>
                <TableCell>{b.email || "N/A"}</TableCell>
                <TableCell>
                  ₦{b.hourly_rate?.toLocaleString()}{" "}
                  <Button variant="ghost" size="icon" className="ml-2" onClick={() => { setEditBabalawo(b); setRate((b.hourly_rate || 0).toString()); }}>
                    <Pencil className="h-4 w-4"/>
                  </Button>
                </TableCell>
                <TableCell>
                  <Button variant="outline" onClick={() => setAvailBabalawo(b)}><Calendar className="h-4 w-4 mr-1"/>Manage</Button>
                </TableCell>
                <TableCell>{b.verification_status === "approved" ? "✅" : "❌"}</TableCell>
                <TableCell>
                  {/* Add future admin actions here */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Edit Rate Modal */}
      <Dialog open={!!editBabalawo} onOpenChange={() => setEditBabalawo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Booking Rate</DialogTitle>
          </DialogHeader>
          <div>
            <label>Set Session Rate (₦):</label>
            <Input value={rate} onChange={e => setRate(e.target.value)} type="number" min={100} />
          </div>
          <DialogFooter>
            <Button onClick={() => editMutation.mutate({ id: editBabalawo.id, rate })} disabled={editMutation.isPending}>Save</Button>
            <Button variant="secondary" onClick={() => setEditBabalawo(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Availability Modal */}
      <Dialog open={!!availBabalawo} onOpenChange={() => setAvailBabalawo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Set Weekly Availability</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {loadingSlots ? (
              <Loader2 className="animate-spin h-6 w-6"/>
            ) : (
              <>
                <Button variant="default" size="sm" onClick={addSlot}>+ Add Slot</Button>
                <div className="space-y-2 mt-2">
                  {slots.map((slot, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={slot.day_of_week}
                        onChange={e => updateSlot(i, "day_of_week", Number(e.target.value))}
                        className="border rounded px-2 py-1"
                      >
                        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, idx) => (
                          <option key={idx} value={idx}>{d}</option>
                        ))}
                      </select>
                      <Input type="time" value={slot.start_time} onChange={e => updateSlot(i, "start_time", e.target.value)} className="w-32" />
                      <span>-</span>
                      <Input type="time" value={slot.end_time} onChange={e => updateSlot(i, "end_time", e.target.value)} className="w-32" />
                      <label className="flex items-center">
                        <input type="checkbox" checked={slot.is_available} onChange={e => updateSlot(i, "is_available", e.target.checked)} className="mr-1"/>
                        Available
                      </label>
                      <Button variant="ghost" size="icon" onClick={() => removeSlot(i)}>🗑️</Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={saveSlots} disabled={loadingSlots}>Save</Button>
            <Button variant="secondary" onClick={() => setAvailBabalawo(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default BabalawoManagement;
