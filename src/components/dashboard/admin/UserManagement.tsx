import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, MoreVertical, ShieldCheck, ShieldOff, Ban, CheckCircle2 } from "lucide-react";
import { useAdminUsers, type AdminUser } from "@/hooks/useAdminUsers";
import { useSetUserRole, useSetUserSuspended } from "@/hooks/useAdminActions";
import { useAuth } from "@/hooks/useAuth";

const roleColor = (role: string) =>
  role === "admin" ? "bg-red-100 text-red-800"
  : role === "babalawo" ? "bg-purple-100 text-purple-800"
  : "bg-blue-100 text-blue-800";

const UserManagement = () => {
  const { user: me } = useAuth();
  const { data: users, isLoading, error } = useAdminUsers();
  const setRole = useSetUserRole();
  const setSuspended = useSetUserSuspended();
  const [searchTerm, setSearchTerm] = useState("");
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState("");

  const term = searchTerm.toLowerCase();
  const filtered = (users ?? []).filter(
    (u) => u.full_name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term),
  );
  const count = (r: string) => (users ?? []).filter((u) => u.roles.includes(r as never)).length;

  if (isLoading) return <div className="flex justify-center items-center h-64 text-lg">Loading users...</div>;
  if (error) return <p className="text-center py-8 text-red-500">Could not load users: {(error as Error).message}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <p className="text-gray-600">Roles and suspensions are enforced in the database and recorded in the activity log.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Total users", users?.length ?? 0],
          ["Babalawos", count("babalawo")],
          ["Admins", count("admin")],
          ["Suspended", (users ?? []).filter((u) => u.is_suspended).length],
        ].map(([label, n]) => (
          <Card key={label as string} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-gray-600">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{n}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input placeholder="Search users by name or email..." value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-lg font-semibold">All Users ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600">
                  <th className="py-3 px-4 font-medium">User</th>
                  <th className="py-3 px-4 font-medium">Roles</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Joined</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isMe = u.id === me?.id;
                  const isAdminUser = u.roles.includes("admin");
                  return (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={u.avatar_url || ""} />
                            <AvatarFallback>{u.full_name?.[0] || "U"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-gray-900">{u.full_name || "Unnamed User"}{isMe && " (you)"}</div>
                            <div className="text-sm text-gray-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.filter((r) => r !== "user" || u.roles.length === 1).map((r) => (
                            <Badge key={r} className={roleColor(r)}>{r}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {u.is_suspended
                          ? <Badge className="bg-red-100 text-red-800" title={u.suspended_reason ?? ""}>Suspended</Badge>
                          : <Badge className="bg-green-100 text-green-800">Active</Badge>}
                      </td>
                      <td className="py-4 px-4 text-gray-900">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                      <td className="py-4 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label={`Actions for ${u.email}`}><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isAdminUser ? (
                              <DropdownMenuItem disabled={isMe || setRole.isPending}
                                onClick={() => setRole.mutate({ userId: u.id, role: "admin", grant: false })}>
                                <ShieldOff className="w-4 h-4 mr-2" />Remove admin
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled={setRole.isPending}
                                onClick={() => window.confirm(`Make ${u.email} an admin? They will get full access.`) &&
                                  setRole.mutate({ userId: u.id, role: "admin", grant: true })}>
                                <ShieldCheck className="w-4 h-4 mr-2" />Make admin
                              </DropdownMenuItem>
                            )}
                            {u.roles.includes("babalawo") ? (
                              <DropdownMenuItem disabled={setRole.isPending}
                                onClick={() => setRole.mutate({ userId: u.id, role: "babalawo", grant: false })}>
                                <ShieldOff className="w-4 h-4 mr-2" />Remove Babalawo role
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled={setRole.isPending}
                                onClick={() => setRole.mutate({ userId: u.id, role: "babalawo", grant: true })}>
                                <ShieldCheck className="w-4 h-4 mr-2" />Grant Babalawo role
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {u.is_suspended ? (
                              <DropdownMenuItem onClick={() => setSuspended.mutate({ userId: u.id, suspended: false })}>
                                <CheckCircle2 className="w-4 h-4 mr-2" />Reinstate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem className="text-red-600" disabled={isMe}
                                onClick={() => { setReason(""); setSuspendTarget(u); }}>
                                <Ban className="w-4 h-4 mr-2" />Suspend
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="text-center py-8 text-gray-500">No users found</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!suspendTarget} onOpenChange={(o) => !o && setSuspendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {suspendTarget?.full_name || suspendTarget?.email}?</DialogTitle>
            <DialogDescription>They will be unable to book sessions, and Babalawos are hidden from search.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason (shown only to admins)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!reason.trim() || setSuspended.isPending}
              onClick={() => {
                if (!suspendTarget) return;
                setSuspended.mutate({ userId: suspendTarget.id, suspended: true, reason: reason.trim() });
                setSuspendTarget(null);
              }}>Suspend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
