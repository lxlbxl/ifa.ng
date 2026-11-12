
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

  const fetchConsultations = async (babalawoId: string) => {
    // Upcoming: pending/confirmed and session_date >= today
    const todayStr = new Date().toISOString().slice(0,10);
    const { data: upcoming, error: upErr } = await supabase
      .from("sessions")
      .select("id, session_date, start_time, end_time, starts_at, ends_at, status, user_id, notes, primary_odu, other_odus, ritual_recommendations, items_needed, deadline, next_appointment, warning, is_instant") // Added is_instant
      .eq("babalawo_id", babalawoId)
      .in("status", ["pending", "confirmed"]) // Added in_progress
      .gte("session_date", todayStr)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });
    console.log('[useBabalawoConsultations] upcoming:', upcoming, 'error:', upErr);
    
    // Completed, Missed, Cancelled (history)
    const { data: past, error: paErr } = await supabase
      .from("sessions")
      .select("id, session_date, start_time, end_time, starts_at, ends_at, status, user_id, notes, primary_odu, other_odus, ritual_recommendations, items_needed, deadline, next_appointment, warning, is_instant") // Added is_instant
      .eq("babalawo_id", babalawoId)
      .in("status", ["completed", "cancelled", "in_progress"])
      .lte("session_date", todayStr)
      .order("session_date", { ascending: false })
      .order("start_time", { ascending: false });
    console.log('[useBabalawoConsultations] past:', past, 'error:', paErr);

    // Get user info for each session, only fetch minimal, simple join (not a true RLS-safe join - in real world would use an edge function)
    // We'll fetch user details for upcoming + past sessions (demo: unique user IDs)
    const userIds = [
      ...(upcoming?.map((s: any) => s.user_id) ?? []),
      ...(past?.map((s: any) => s.user_id) ?? [])
    ].filter(Boolean);
    console.log('[useBabalawoConsultations] userIds:', userIds);
    const uniqueUserIds = Array.from(new Set(userIds));
    console.log('[useBabalawoConsultations] uniqueUserIds:', uniqueUserIds);
    let users: Record<string, any> = {};
    if (uniqueUserIds.length > 0) {
      const { data: userData, error: userDataError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", uniqueUserIds);
      console.log('[useBabalawoConsultations] userData:', userData, 'error:', userDataError);
      if (userData) {
        for (const u of userData) users[u.id] = u;
      }
    }

    return {
      upcoming: upcoming ?? [],
      history: past ?? [],
      users,
    };
  };

  export const useBabalawoConsultations = () => {
    const { user } = useAuth();
    return useQuery({
      queryKey: ["babalawoConsultations", user?.id],
      queryFn: () => user?.id ? fetchConsultations(user.id) : null,
      enabled: !!user?.id,
      staleTime: 60000,
    });
  };
