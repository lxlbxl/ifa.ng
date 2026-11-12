import React from "react";
import { ArrowRight, CalendarDays, Clock, Video } from "lucide-react";
import { differenceInCalendarDays, differenceInMinutes, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eyebrow, Marquee, PortraitCard, StatTile, TickDot } from "@/components/brand";
import { blockColors } from "@/design/tokens";
import { useAuth } from "@/hooks/useAuth";
import { useUserSessions } from "@/hooks/useUserSessions";
import { useUserDashboardStats } from "@/hooks/useUserDashboardStats";
import { useFeaturedBabalawos } from "@/hooks/useBabalawoSearch";
import { babalawoChips } from "@/components/FeaturedBabalawos";
import { ClothStrip, EmptyState, Panel, PanelHeader, greeting } from "@/components/dashboard/shell/Panel";
import WalletWidget from "./WalletWidget";
import { sessionStart, sessionEnd } from "@/utils/sessionTime";

type S = NonNullable<ReturnType<typeof useUserSessions>["data"]>[number];

const startOf = (s: S) => sessionStart(s);
const endOf = (s: S) => sessionEnd(s);
const joinable = (s: S, now = new Date()) =>
  s.status === "confirmed" && differenceInMinutes(startOf(s), now) <= 10 && now <= endOf(s);

const until = (s: S, now = new Date()) => {
  const m = differenceInMinutes(startOf(s), now);
  if (m <= 0) return "Now";
  if (m < 60) return `in ${m} min`;
  if (m < 60 * 24) return `in ${Math.floor(m / 60)} h ${m % 60} min`;
  const d = differenceInCalendarDays(startOf(s), now);
  if (d <= 0) return `today, ${format(startOf(s), "h:mm a")}`;
  return d === 1 ? "tomorrow" : `in ${d} days`;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "Confirmed", cls: "bg-leaf text-ink" },
  pending: { label: "Awaiting Babalawo", cls: "bg-sun-200 text-ink" },
  awaiting_payment: { label: "Awaiting payment", cls: "bg-coral-100 text-coral-700" },
};

const initials = (n: string) => n.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** The next session as a paper "ticket" on the ink greeting band. */
const NextTicket = ({ s }: { s: S }) => (
  <div className="w-full max-w-[360px] rotate-[1.5deg] rounded-panel border-2 border-ink bg-paper p-5 text-ink shadow-[8px_8px_0_#c7e86a]">
    <div className="flex items-center justify-between gap-2">
      <Eyebrow className="text-camwood">{s.session_type === "ebo_ritual" ? "Ebo ritual" : "Next consultation"}</Eyebrow>
      <span className={`rounded-pill px-2.5 py-0.5 text-[11px] font-bold ${STATUS[s.status]?.cls ?? "bg-cloth"}`}>{STATUS[s.status]?.label ?? s.status}</span>
    </div>
    <div className="mt-4 flex items-center gap-3">
      <Avatar className="h-12 w-12 border-2 border-ink">
        <AvatarImage src={s.babalawo_avatar ?? undefined} alt="" />
        <AvatarFallback className="bg-teal font-bold text-white">{initials(s.babalawo_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-extrabold leading-tight tracking-[-0.02em]">{s.babalawo_name}</p>
        <p className="text-sm text-muted-foreground">{s.babalawo_specialties?.[0] ?? "Ifá consultation"}</p>
      </div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-dashed border-line pt-4 text-sm">
      <p className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-camwood" />{format(startOf(s), "EEE d MMM")}</p>
      <p className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-camwood" />{format(startOf(s), "h:mm a")}</p>
    </div>
    <p className="mt-3 font-display text-3xl font-extrabold tracking-[-0.03em]">{until(s)}</p>
  </div>
);

const ClientHome: React.FC<{ onNavigate: (id: string) => void }> = ({ onNavigate }) => {
  const { userProfile } = useAuth();
  const { data: sessions = [], isLoading } = useUserSessions();
  const { data: stats } = useUserDashboardStats();
  const { featuredBabalawos: babalawos } = useFeaturedBabalawos(12);
  const now = new Date();
  const upcoming = sessions
    .filter((s) => endOf(s) >= now && ["confirmed", "pending", "awaiting_payment"].includes(s.status))
    .sort((a, b) => +startOf(a) - +startOf(b));
  const next = upcoming[0];
  const first = (userProfile?.full_name || "").split(" ")[0] || "friend";
  const g = greeting(now);

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Greeting band */}
      <section className="relative overflow-hidden rounded-card bg-ink px-6 pb-8 pt-8 text-cloth sm:px-10 sm:pt-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-green-700/40 blur-0" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-28 right-40 h-56 w-56 rounded-full bg-camwood/30" aria-hidden="true" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-[560px]">
            <Eyebrow className="text-sun">{g.yo} · {g.en}</Eyebrow>
            <h1 className="mt-3 font-display text-[clamp(44px,6vw,80px)] font-extrabold leading-[0.9] tracking-[-0.045em]">
              {first}
            </h1>
            <p className="mt-4 max-w-[46ch] text-lg text-cloth/75">
              {next
                ? <>Your next consultation is with <strong className="text-cloth">{next.babalawo_name}</strong>, {format(startOf(next), "EEEE 'at' h:mm a")}.</>
                : "Ask Ifá what lies ahead. A Babalawo can see you today."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {next && joinable(next) ? (
                <Button variant="sun" size="lg" onClick={() => window.open(`/session/${next.id}`, "_blank")}>
                  <Video />Join your session
                </Button>
              ) : (
                <Button variant="sun" size="lg" onClick={() => onNavigate("find-babalawo")}>
                  Book a consultation<ArrowRight />
                </Button>
              )}
              <Button variant="glass" size="lg" onClick={() => onNavigate("spiritual-journey")}>Notes & Ebo</Button>
            </div>
          </div>
          {next && <div className="hidden justify-end sm:flex"><NextTicket s={next} /></div>}
        </div>
        <ClothStrip className="relative mt-10" />
      </section>

      {/* Numbers */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatTile tone="leaf" label="Coming up" value={stats?.upcoming ?? "–"} hint="Booked sessions" />
        <StatTile tone="paper" label="Completed" value={stats?.completed ?? "–"} hint="Consultations so far" />
        <div className="col-span-2 lg:col-span-1"><WalletWidget /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <Panel>
          <PanelHeader
            eyebrow="Your diary"
            title="Coming up"
            action={<Button variant="outline" size="sm" onClick={() => onNavigate("my-sessions")}>All sessions</Button>}
          />
          {isLoading ? (
            <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-field bg-cloth" />)}</div>
          ) : upcoming.length === 0 ? (
            <EmptyState icon={<CalendarDays />} title="Nothing booked yet" action={<Button onClick={() => onNavigate("find-babalawo")}>Find a Babalawo</Button>}>
              Book a consultation and it will appear here with its Meet link.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.slice(0, 4).map((s) => {
                const d = startOf(s);
                return (
                  <li key={s.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                    <div className="grid w-14 shrink-0 place-items-center rounded-field border-2 border-ink bg-cloth py-1.5 text-center leading-none">
                      <span className="eyebrow text-[10px] text-camwood">{format(d, "MMM")}</span>
                      <span className="font-display text-2xl font-extrabold">{format(d, "d")}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.babalawo_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(d, "EEE, h:mm a")} · {s.session_type === "ebo_ritual" ? "Ebo ritual" : "Consultation"}
                      </p>
                    </div>
                    {joinable(s) ? (
                      <Button size="sm" onClick={() => window.open(`/session/${s.id}`, "_blank")}><Video />Join</Button>
                    ) : (
                      <span className={`hidden shrink-0 rounded-pill px-3 py-1 text-xs font-bold sm:inline ${STATUS[s.status]?.cls ?? "bg-cloth"}`}>
                        {STATUS[s.status]?.label ?? s.status}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <div className="rounded-panel bg-[#bfe6e1] p-6 text-ink">
            <Eyebrow className="text-ink/60">Before you sit</Eyebrow>
            <h3 className="mt-1.5 font-display text-2xl font-extrabold tracking-[-0.02em]">A good consultation</h3>
            <ul className="mt-4 space-y-3 text-[15px]">
              {["Join a few minutes early, somewhere quiet.", "Bring one clear question to Ifá.", "Keep a pen close for what you hear."].map((t, i) => (
                <li key={t} className="flex items-center gap-3"><TickDot>{i + 1}</TickDot>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {babalawos.length > 0 && (
        <section className="-mx-4 overflow-hidden sm:-mx-6 lg:mx-0 lg:rounded-card lg:border lg:border-line lg:bg-paper">
          <div className="flex flex-wrap items-end justify-between gap-4 px-4 pt-2 sm:px-6 lg:px-8 lg:pt-8">
            <div>
              <Eyebrow className="text-camwood">Verified Babalawos</Eyebrow>
              <h2 className="mt-2 font-display text-display-sm font-extrabold">Who will you sit with?</h2>
            </div>
            <Button variant="outline" onClick={() => onNavigate("find-babalawo")}>See everyone<ArrowRight /></Button>
          </div>
          <Marquee
            items={babalawos}
            label="Babalawos"
            trackClassName="pb-8 pt-6"
            duration={Math.max(30, babalawos.length * 7.5)}
            renderItem={(b, i, isClone) => (
              <PortraitCard
                key={`${b.id}${isClone ? "-c" : ""}`}
                name={b.full_name}
                imageUrl={b.avatar_url}
                chips={babalawoChips(b)}
                status={b.current_status === "online" || b.current_status === "available" ? "available" : null}
                color={blockColors[i % blockColors.length]}
                tilt={i % 2 ? "right" : "left"}
                to={`/babalawo/${b.id}`}
                tabIndex={isClone ? -1 : undefined}
              />
            )}
          />
        </section>
      )}
    </div>
  );
};

export default ClientHome;
