import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
interface Row { id: number; session_id: number; user_id: string; babalawo_id: string | null; rating: number; comment: string | null; is_approved: boolean; created_at: string }

/** Client reviews: publish or hide. New reviews publish straight away unless "reviews_need_approval" is on. */
const AdminReviews: React.FC = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await db.from("reviews").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      const ids = Array.from(new Set(rows.flatMap((r) => [r.user_id, r.babalawo_id]).filter(Boolean)));
      const { data: people } = ids.length ? await db.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      const name = Object.fromEntries((people ?? []).map((p: any) => [p.id, p.full_name || p.id.slice(0, 8)]));
      return rows.map((r) => ({ ...r, client: name[r.user_id] ?? "Client", babalawo: r.babalawo_id ? name[r.babalawo_id] ?? "Babalawo" : "–" }));
    },
  });
  const toggle = async (r: Row) => {
    const { error } = await db.from("reviews").update({ is_approved: !r.is_approved }).eq("id", r.id);
    if (error) return toast({ title: "Not changed", description: error.message, variant: "destructive" });
    toast({ title: r.is_approved ? "Review hidden" : "Review published" });
    qc.invalidateQueries({ queryKey: ["admin-reviews"] });
  };
  return (
    <Card>
      <CardHeader><CardTitle>Reviews</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : !data?.length ? <p className="py-8 text-center text-muted-foreground">No reviews yet.</p> : (
          <ul className="divide-y divide-line">
            {data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-4 w-4 ${i <= r.rating ? "fill-sun text-sun" : "text-line"}`} />)}</span>
                    <Badge variant="outline">{r.is_approved ? "Published" : "Hidden"}</Badge>
                  </div>
                  {r.comment && <p className="mt-1">“{r.comment}”</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{r.client} on {r.babalawo} · session {r.session_id} · {format(new Date(r.created_at), "d MMM yyyy")}</p>
                </div>
                <Button size="sm" variant={r.is_approved ? "outline" : "default"} onClick={() => toggle(r)}>{r.is_approved ? "Hide" : "Publish"}</Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminReviews;
