
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, MoreVertical, UserPlus, Filter, Edit, Trash2, Star, Clock, DollarSign, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useAdminBabalawos } from "@/hooks/useAdminBabalawos";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const BabalawoManagement = () => {
  const { data: babalawos, isLoading } = useAdminBabalawos();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBabalawo, setSelectedBabalawo] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    hourly_rate: "",
    experience_years: "",
    bio: "",
    specialties: "",
    commission_percentage: "",
  });
  const [addForm, setAddForm] = useState({
    email: "",
    full_name: "",
    specialties: "",
    experience_years: "",
    hourly_rate: "",
    bio: "",
    languages: "",
    commission_percentage: "",
  });
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filteredBabalawos = babalawos?.filter(babalawo =>
    babalawo.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    babalawo.specialties?.some((specialty: string) => 
      specialty.toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const resetAddForm = () => setAddForm({
    email: "",
    full_name: "",
    specialties: "",
    experience_years: "",
    hourly_rate: "",
    bio: "",
    languages: "",
    commission_percentage: "",
  });

  const resetEditForm = () => setEditForm({
    hourly_rate: "",
    experience_years: "",
    bio: "",
    specialties: "",
    commission_percentage: "",
  });

  const handleAddBabalawo = async () => {
    if (!addForm.email || !addForm.full_name) {
      toast({ title: "Missing Info", description: "Email and Full Name are required.", variant: "destructive" });
      return;
    }
    setIsAdding(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
        email: addForm.email,
        email_confirm: true,
        user_metadata: {
          full_name: addForm.full_name,
          role: "babalawo"
        }
      });

      if (signUpError || !signUpData?.user?.id) throw signUpError || new Error("No user ID");

      const userId = signUpData.user.id;

      await supabase
        .from("profiles")
        .update({ full_name: addForm.full_name, role: "babalawo" })
        .eq("id", userId);

      const specialtiesArr = addForm.specialties
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const languagesArr = addForm.languages
        ? addForm.languages.split(",").map((v) => v.trim()).filter(Boolean)
        : ["English"];

      await supabase.from("babalawos").insert({
        id: userId,
        specialties: specialtiesArr,
        experience_years: Number(addForm.experience_years) || 0,
        hourly_rate: Number(addForm.hourly_rate) || 0,
        verification_status: "approved",
        bio: addForm.bio,
        languages: languagesArr,
        is_active: true,
      });

      toast({ title: "Babalawo Created", description: "A new babalawo has been added and approved." });
      setIsAddModalOpen(false);
      resetAddForm();
      queryClient.invalidateQueries({ queryKey: ['adminBabalawos'] });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to add babalawo", variant: "destructive" });
    }
    setIsAdding(false);
  };

  const handleVerification = async (babalawoId: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("babalawos")
        .update({ verification_status: status })
        .eq("id", babalawoId);

      if (error) throw error;

      toast({
        title: status === "approved" ? "Approved" : "Rejected",
        description: `Babalawo has been ${status}.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['adminBabalawos'] });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Update failed", variant: "destructive" });
    }
  };

  const handleEditBabalawo = async () => {
    if (!selectedBabalawo) return;
    
    setIsUpdating(true);
    try {
      const specialtiesArr = editForm.specialties
        ? editForm.specialties.split(",").map((v) => v.trim()).filter(Boolean)
        : selectedBabalawo.specialties;

      const { error } = await supabase
        .from("babalawos")
        .update({
          hourly_rate: Number(editForm.hourly_rate) || selectedBabalawo.hourly_rate,
          experience_years: Number(editForm.experience_years) || selectedBabalawo.experience_years,
          bio: editForm.bio || selectedBabalawo.bio,
          specialties: specialtiesArr,
        })
        .eq("id", selectedBabalawo.id);

      if (error) throw error;

      toast({ title: "Updated", description: "Babalawo profile has been updated successfully." });
      setIsEditModalOpen(false);
      resetEditForm();
      setSelectedBabalawo(null);
      queryClient.invalidateQueries({ queryKey: ['adminBabalawos'] });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Update failed", variant: "destructive" });
    }
    setIsUpdating(false);
  };

  const handleDeactivate = async (babalawoId: string) => {
    try {
      const { error } = await supabase
        .from("babalawos")
        .update({ is_active: false })
        .eq("id", babalawoId);

      if (error) throw error;

      toast({ title: "Deactivated", description: "Babalawo has been deactivated." });
      queryClient.invalidateQueries({ queryKey: ['adminBabalawos'] });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Deactivation failed", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading babalawos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Babalawo Management</h2>
          <p className="text-gray-600">Manage all registered babalawos and their verification status</p>
        </div>
        <Button
          className="bg-purple-600 hover:bg-purple-700"
          onClick={() => setIsAddModalOpen(true)}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add New Babalawo
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Babalawos</p>
                <p className="text-2xl font-bold text-gray-900">{babalawos?.length || 0}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-50">
                <Star className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">
                  {babalawos?.filter(b => b.verification_status === 'approved').length || 0}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-50">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">
                  {babalawos?.filter(b => b.verification_status === 'pending').length || 0}
                </p>
              </div>
              <div className="p-3 rounded-full bg-yellow-50">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">
                  {babalawos?.filter(b => b.is_active).length || 0}
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-50">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search babalawos by ID or specialties..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Babalawos Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">All Babalawos ({filteredBabalawos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Babalawo</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Rating</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Sessions</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Hourly Rate</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Experience</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBabalawos.map((babalawo) => (
                  <tr key={babalawo.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {babalawo.id.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-gray-900">Babalawo #{babalawo.id.slice(0, 8)}</div>
                          <div className="text-sm text-gray-500">
                            {babalawo.specialties?.slice(0, 2).join(", ") || "No specialties"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge className={getStatusColor(babalawo.verification_status || 'pending')}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(babalawo.verification_status || 'pending')}
                          {babalawo.verification_status || 'pending'}
                        </div>
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span className="font-medium">{babalawo.rating || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-900">{babalawo.total_sessions || 0}</td>
                    <td className="py-4 px-4 text-gray-900">₦{babalawo.hourly_rate || 0}/hr</td>
                    <td className="py-4 px-4 text-gray-900">{babalawo.experience_years || 0} years</td>
                    <td className="py-4 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedBabalawo(babalawo);
                            setEditForm({
                              hourly_rate: babalawo.hourly_rate?.toString() || "",
                              experience_years: babalawo.experience_years?.toString() || "",
                              bio: babalawo.bio || "",
                              specialties: babalawo.specialties?.join(", ") || "",
                              commission_percentage: (babalawo as any).commission_babalawo_percent?.toString() || "",
                            });
                            setIsEditModalOpen(true);
                          }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Profile
                          </DropdownMenuItem>
                          {babalawo.verification_status === 'pending' && (
                            <>
                              <DropdownMenuItem
                                className="text-green-600"
                                onClick={() => handleVerification(babalawo.id, "approved")}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleVerification(babalawo.id, "rejected")}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDeactivate(babalawo.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Deactivate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Babalawo Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={o => { setIsAddModalOpen(o); if (!o) resetAddForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Babalawo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email<span className="text-red-500">*</span></label>
              <Input
                value={addForm.email}
                onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                placeholder="babalawo@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name<span className="text-red-500">*</span></label>
              <Input
                value={addForm.full_name}
                onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Full Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Specialties (comma separated)</label>
              <Input
                value={addForm.specialties}
                onChange={e => setAddForm(f => ({ ...f, specialties: e.target.value }))}
                placeholder="Divination, Cleansing"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experience (Years)</label>
                <Input
                  type="number"
                  value={addForm.experience_years}
                  onChange={e => setAddForm(f => ({ ...f, experience_years: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (₦)</label>
                <Input
                  type="number"
                  value={addForm.hourly_rate}
                  onChange={e => setAddForm(f => ({ ...f, hourly_rate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Languages (comma separated)</label>
              <Input
                value={addForm.languages}
                onChange={e => setAddForm(f => ({ ...f, languages: e.target.value }))}
                placeholder="English, Yoruba"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                className="w-full p-2 border border-gray-300 rounded-md"
                rows={3}
                value={addForm.bio}
                onChange={e => setAddForm(f => ({ ...f, bio: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" disabled={isAdding} onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white" disabled={isAdding} onClick={handleAddBabalawo}>
                {isAdding ? "Adding..." : "Add Babalawo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Babalawo Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={o => { setIsEditModalOpen(o); if (!o) { resetEditForm(); setSelectedBabalawo(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Babalawo Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (₦)</label>
                <Input 
                  type="number" 
                  value={editForm.hourly_rate}
                  onChange={e => setEditForm(f => ({ ...f, hourly_rate: e.target.value }))}
                  placeholder={selectedBabalawo?.hourly_rate?.toString() || "Enter hourly rate"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experience (Years)</label>
                <Input 
                  type="number" 
                  value={editForm.experience_years}
                  onChange={e => setEditForm(f => ({ ...f, experience_years: e.target.value }))}
                  placeholder={selectedBabalawo?.experience_years?.toString() || "Enter years of experience"}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea 
                className="w-full p-2 border border-gray-300 rounded-md"
                rows={3}
                value={editForm.bio}
                onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))}
                placeholder={selectedBabalawo?.bio || "Enter bio"}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Specialties (comma separated)</label>
              <Input 
                value={editForm.specialties}
                onChange={e => setEditForm(f => ({ ...f, specialties: e.target.value }))}
                placeholder={selectedBabalawo?.specialties?.join(", ") || "Enter specialties"}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" disabled={isUpdating} onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button disabled={isUpdating} onClick={handleEditBabalawo}>
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BabalawoManagement;
