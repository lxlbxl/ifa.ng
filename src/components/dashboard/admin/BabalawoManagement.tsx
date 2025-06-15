
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

const BabalawoManagement = () => {
  const { data: babalawos, isLoading } = useAdminBabalawos();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBabalawo, setSelectedBabalawo] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
        <Button className="bg-purple-600 hover:bg-purple-700">
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
                            setIsEditModalOpen(true);
                          }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Profile
                          </DropdownMenuItem>
                          {babalawo.verification_status === 'pending' && (
                            <>
                              <DropdownMenuItem className="text-green-600">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem className="text-red-600">
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

      {/* Edit Babalawo Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Babalawo Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (₦)</label>
                <Input type="number" defaultValue={selectedBabalawo?.hourly_rate || ''} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experience (Years)</label>
                <Input type="number" defaultValue={selectedBabalawo?.experience_years || ''} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea 
                className="w-full p-2 border border-gray-300 rounded-md"
                rows={3}
                defaultValue={selectedBabalawo?.bio || ''}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Specialties</label>
              <Input defaultValue={selectedBabalawo?.specialties?.join(", ") || ''} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BabalawoManagement;
