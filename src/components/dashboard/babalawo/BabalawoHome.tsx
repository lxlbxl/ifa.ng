import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Star, Video, Zap } from "lucide-react";
import { differenceInMinutes, format, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eyebrow, StatTile } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBabalawoConsultations } from "@/hooks/useBabalawoConsultations";
import { useBabalawoReviews } from "@/hooks/useBabalawoReviews";
import { useBabalawoDashboardStats } from "@/hooks/useBabalawoDashboardStatsSimple";
import { ClothStrip, EmptyState, Panel, PanelHeader, greeting } from "@/components/dashboard/shell/Panel";
import { PresenceCard } from "./PresenceToggle";

type Row = { id: number; session_date: string; start_time: string; end_time: string; status: string; user_id: string; is_instant?: boolean };

const startOf = (s: Row) => new Date(`${s.session_date}T${s.start_time}`);
const endOf = (s: Row) => new Date(`${s.session_date}T${s.end_time || s.start_time}`);
const joinable = (s: Row, now = new Date()) => s.status === "confirmed" && differenceInMinutes(startOf(s), now) <= 10 && now <= endOf(s);
const initials = (n: string) => n.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "C";
const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;

const useWallet = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["babalawo-wallet", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("babalawo_wallets").select("available_balance, pending_balance").eq("babalawo_id", user!.id).maybeSingle();
      return { available: Number(data?.available_balance ?? 0), pending: Number((data as { pending_balance?: number } | null)?.pending_balance ?? 0) };
    },
  });
};

const Stars = ({ n }: { n: number }) => (
  <span className="flex gap-0.5" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={i <= n ? "h-4 w-4 fill-sun text-sun" : "h-4 w-4 text-line"} />)}
  </span>
);

const BabalawoHome: React.FC<{ onNavigate: (id: string) => void }> = ({ onNavigate }) => {
  const { userProfile } = useAuth();
  const { data: c, isLoading } = useBabalawoConsultations();
  const { data: reviews = [] } = useBabalawoReviews();
  const { data: stats } = useBabalawoDashboardStats();
  const { data: wallet } = useWallet();
  const now = new Date();
  const upcoming = ((c?.upcoming ?? []) as Row[]).filter((s) => endOf(s) >= now).sort((a, b) => +startOf(a) - +startOf(b));
  const today = upcoming.filter((s) => isToday(startOf(s)));
  const next = upcoming[0];
  const nameOf = (id: string) => c?.users?.[id]?.full_name || "Client";
  const rating = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null;
  const g = greeting(now);
  const name = (userProfile?.full_name || "").replace(/^Babalawo\s+/i, "").split(" ")[0] || "Babalawo";

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
        <section className="relative overflow-hidden rounded-card bg-ink px-6 pb-8 pt-8 text-cloth sm:px-10 sm:pt-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-camwood/45" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-green-700/50" aria-hidden="true" />
          <div className="relative">
            <Eyebrow className="text-sun">{g.yo} · {g.en}</Eyebrow>
            <h1 className="mt-3 font-display text-[clamp(44px,6vw,80px)] font-extrabold leading-[0.9] tracking-[-0.045em]">
              Babalawo {name}<span className="text-leaf">.</span>
            </h1>
            <p className="mt-4 max-w-[46ch] text-lg text-cloth/75">
              {isLoading ? "Checking your diary…"
                : today.length ? <>You have <strong className="text-cloth">{today.length} {today.length === 1 ? "consultation" : "consultations"}</strong> today. The next is with {nameOf(today[0].user_id)} at {format(startOf(today[0]), "h:mm a")}.</>
                : next ? <>Nothing booked today. Your next consultation is {format(startOf(next), "EEEE d MMMM 'at' h:mm a")}.</>
                : "Your diary is clear. Go Online so clients can Consult Now."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {next && joinable(next) ? (
                <Button variant="sun" size="lg" onClick={() => window.open(`/session/${next.id}`, "_blank")}><Video />Join {nameOf(next.user_id).split(" ")[0]}</Button>
              ) : (
                <Button variant="sun" size="lg" onClick={() => onNavigate("consultations")}>Open my sessions<ArrowRight /></Button>
              )}
              <Button variant="glass" size="lg" onClick={() => onNavigate("availability")}>Set my hours</Button>
            </div>
            <ClothStrip className="mt-10" />
          </div>
        </section>
        <PresenceCard />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile tone="leaf" label="Today" value={today.length} hint={today.length === 1 ? "Consultation" : "Consultations"} />
        <StatTile tone="paper" label="Coming up" value={upcoming.length} hint={`${stats?.completedSessions ?? 0} completed so far`} />
        <StatTile tone="indigo" label="Ready to withdraw" value={wallet ? naira(wallet.available) : "–"} hint={wallet?.pending ? `${naira(wallet.pending)} held until rituals are done` : "Your available balance"} />
        <StatTile tone="coral" label="Rating" value={rating ? rating.toFixed(1) : "New"} hint={reviews.length ? `From ${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}` : "No reviews yet"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
        <Panel>
          <PanelHeader
            eyebrow="Your diary"
            title="Coming up"
            action={<Button variant="outline" size="sm" onClick={() => onNavigate("consultations")}>All sessions</Button>}
          />
          {isLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-field bg-cloth" />)}</div>
          ) : upcoming.length === 0 ? (
            <EmptyState icon={<CalendarDays />} title="No bookings yet" action={<Button onClick={() => onNavigate("availability")}>Open more hours</Button>}>
              Clients book from the hours you open. Add a few this week.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.slice(0, 5).map((s) => {
                const d = startOf(s);
                const who = c?.users?.[s.user_id];
                return (
                  <li key={s.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                    <div className="w-[68px] shrink-0 text-right">
                      <p className="font-display text-lg font-extrabold leading-none">{format(d, "h:mm")}</p>
                      <p className="eyebrow mt-1 text-[10px] text-camwood">{isToday(d) ? "Today" : format(d, "EEE d")}</p>
                    </div>
                    <span className={`h-10 w-1 shrink-0 rounded-pill ${s.status === "confirmed" ? "bg-leaf" : "bg-sun"}`} aria-hidden="true" />
                    <Avatar className="h-10 w-10 border border-line">
                      <AvatarImage src={who?.avatar_url ?? undefined} alt="" />
                      <AvatarFallback className="bg-cloth text-sm font-bold">{initials(who?.full_name || "Client")}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{who?.full_name || "Client"}</p>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        {s.is_instant && <Zap className="h-3.5 w-3.5 text-camwood" />}
                        {s.is_instant ? "Consult Now" : "Consultation"} · {s.status === "confirmed" ? "Confirmed" : "Needs your answer"}
                      </p>
                    </div>
                    {joinable(s) && <Button size="sm" onClick={() => window.open(`/session/${s.id}`, "_blank")}><Video />Join</Button>}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel tone="cloth" className="bg-[#f3e6c8]">
          <PanelHeader eyebrow="What clients say" title="Latest reviews" action={reviews.length > 0 && <Button variant="ghost" size="sm" onClick={() => onNavigate("reviews")}>All</Button>} />
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">Reviews appear here after clients rate a completed consultation.</p>
          ) : (
            <ul className="space-y-3">
              {reviews.slice(0, 3).map((r) => (
                <li key={r.id} className="rounded-field bg-paper p-4">
                  <Stars n={r.rating} />
                  {r.comment && <p className="mt-2 text-[15px] leading-snug">“{r.comment}”</p>}
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    {r.user?.full_name || "A client"}{r.created_at ? ` · ${format(new Date(r.created_at), "d MMM")}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default BabalawoHome;
