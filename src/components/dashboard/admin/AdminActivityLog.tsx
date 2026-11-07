import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const fetchLog = async () => {
  const { data, error } = await supabase
    .from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  const ids = Array.from(new Set((data ?? []).map((r) => r.admin_id).filter(Boolean))) as string[];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  return (data ?? []).map((r) => {
    const p = profiles?.find((x) => x.id === r.admin_id);
    return { ...r, adminName: p?.full_name || p?.email || "system" };
  });
};

const AdminActivityLog: React.FC = () => {
  const { data, isLoading, error } = useQuery({ queryKey: ["adminAuditLog"], queryFn: fetchLog });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin activity</CardTitle>
        <p className="text-sm text-gray-600">Every role change, suspension, verification, booking override and dispute decision.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="py-8 text-center">Loading...</p>}
        {error && <p className="py-8 text-center text-red-500">{(error as Error).message}</p>}
        {(data ?? []).map((r) => (
          <div key={r.id} className="flex flex-wrap items-start gap-2 border-b py-2 text-sm">
            <span className="text-gray-500 w-44 shrink-0">{new Date(r.created_at).toLocaleString()}</span>
            <Badge variant="outline">{r.action.replace(/_/g, " ")}</Badge>
            <span>{r.adminName}</span>
            <span className="text-gray-500">→ {r.target_type} {r.target_id?.slice(0, 8)}</span>
            {r.details && Object.keys(r.details as object).length > 0 && (
              <code className="text-xs text-gray-500 break-all">{JSON.stringify(r.details)}</code>
            )}
          </div>
        ))}
        {!isLoading && !data?.length && <p className="py-8 text-center text-gray-500">No admin activity yet.</p>}
      </CardContent>
    </Card>
  );
};

export default AdminActivityLog;
