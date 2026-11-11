import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Menu, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand";
import { PageIntro } from "./Panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Short label for the phone bottom bar. */
  short?: string;
}
export interface Intro {
  eyebrow?: string;
  title?: string;
  lede?: React.ReactNode;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

interface ShellProps {
  audience: "client" | "babalawo";
  groups: NavGroup[];
  /** Up to five section ids shown in the phone bottom bar. */
  mobile: string[];
  active: string;
  onNavigate: (id: string) => void;
  /** Bar above the header, such as the network quality strip. */
  topBar?: React.ReactNode;
  /** Extra controls in the header, before the bell. */
  headerExtra?: React.ReactNode;
  /** Page headings, by section id. The home page brings its own. */
  intros?: Record<string, Intro>;
  /** Kept mounted across page changes: live alerts, modals. */
  persistent?: React.ReactNode;
  children: React.ReactNode;
}

const initials = (name: string) =>
  name.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "I";

const useUnread = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["unread-notifications", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
  });
};

/** The ink sidebar: logo, grouped navigation with a leaf pill for the current page, and the signed-in person. */
const SideNav = ({ audience, groups, active, onNavigate }: Pick<ShellProps, "audience" | "groups" | "active" | "onNavigate">) => {
  const { userProfile, user, signOut } = useAuth();
  const name = userProfile?.full_name || user?.email || (audience === "babalawo" ? "Babalawo" : "You");
  return (
    <div className="flex h-full flex-col bg-ink text-cloth">
      <div className="flex items-center gap-3 px-6 pb-6 pt-7">
        <Logo tone="light" size="sm" to="/" />
        <span className="ml-auto rounded-pill border border-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-leaf">
          {audience === "babalawo" ? "Babalawo" : "Client"}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Dashboard">
        {groups.map((g) => (
          <div key={g.label} className="mb-5">
            <p className="eyebrow mb-1.5 px-3 text-cloth/45">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const on = item.id === active;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-section={item.id}
                      onClick={() => onNavigate(item.id)}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-pill px-3 py-2.5 text-left text-[15px] font-semibold transition-colors",
                        on ? "bg-leaf text-ink" : "text-cloth/75 hover:bg-white/[0.07] hover:text-cloth",
                      )}
                    >
                      <item.icon className={cn("h-[18px] w-[18px] shrink-0", on ? "text-ink" : "text-cloth/55 group-hover:text-cloth")} />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="m-3 flex items-center gap-3 rounded-panel bg-white/[0.06] p-3">
        <Avatar className="h-10 w-10 border-2 border-leaf">
          <AvatarImage src={userProfile?.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="bg-sun font-bold text-ink">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="text-xs text-cloth/55">{audience === "babalawo" ? "Babalawo" : "Client"}</p>
        </div>
        <button
          type="button"
          onClick={async () => { await signOut(); window.location.href = "/"; }}
          className="grid h-9 w-9 place-items-center rounded-full text-cloth/70 transition-colors hover:bg-white/10 hover:text-cloth"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

/**
 * One layout for the client and Babalawo dashboards, matching the homepage:
 * an ink sidebar on desktop, a cloth page, a quiet header with the page name in
 * Bricolage, and an ink-on-paper bottom bar on phones.
 */
const DashboardShell: React.FC<ShellProps> = ({ audience, groups, mobile, active, onNavigate, topBar, headerExtra, persistent, intros, children }) => {
  const [open, setOpen] = React.useState(false);
  const { userProfile } = useAuth();
  const { data: unread = 0 } = useUnread();
  const all = groups.flatMap((g) => g.items);
  const current = all.find((i) => i.id === active) ?? all[0];
  const go = (id: string) => {
    onNavigate(id);
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const name = userProfile?.full_name || "";

  return (
    <div className="min-h-screen bg-cloth text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] lg:block">
        <SideNav audience={audience} groups={groups} active={active} onNavigate={go} />
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-[272px]">
        <div className="sticky top-0 z-20">
          {topBar}
          <header className="border-b border-line bg-cloth/95 backdrop-blur supports-[backdrop-filter]:bg-cloth/80">
            <div className="mx-auto flex h-[68px] max-w-[1240px] items-center gap-3 px-4 sm:h-[76px] sm:px-6 lg:px-10">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <button type="button" className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink lg:hidden" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[288px] max-w-[85vw] border-0 bg-ink p-0">
                  <SheetTitle className="sr-only">Menu</SheetTitle>
                  <SideNav audience={audience} groups={groups} active={active} onNavigate={go} />
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1">
                <p className="eyebrow hidden text-camwood sm:block">{today}</p>
                <p className="truncate font-display text-xl font-extrabold leading-tight tracking-[-0.03em] sm:text-2xl lg:hidden">{current?.short ?? current?.label}</p>
                <p className="hidden truncate text-sm font-semibold text-muted-foreground lg:block">
                  {audience === "babalawo" ? "Babalawo space" : "Your space"} <span className="mx-1 text-line">/</span> <span className="text-ink">{current?.label}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {headerExtra}
                <button
                  type="button"
                  onClick={() => go("notifications")}
                  className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-paper transition-colors hover:border-ink"
                  aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-pill bg-coral px-1 text-[10px] font-bold text-white ring-2 ring-cloth">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
                <Avatar className="hidden h-10 w-10 border-2 border-ink sm:flex">
                  <AvatarImage src={userProfile?.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-sun text-sm font-bold text-ink">{initials(name)}</AvatarFallback>
                </Avatar>
              </div>
            </div>
          </header>
        </div>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pb-14">
          <div key={active} className="animate-fade-in">
            {intros?.[active] && <PageIntro eyebrow={intros[active].eyebrow} title={intros[active].title ?? current?.label} lede={intros[active].lede} />}
            {children}
          </div>
        </main>
        {persistent}
      </div>

      <nav
        className="fixed inset-x-3 bottom-3 z-40 rounded-pill border-2 border-ink bg-paper px-1.5 py-1.5 shadow-sticker lg:hidden"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Quick navigation"
      >
        <ul className="flex items-center justify-between">
          {mobile.map((id) => {
            const item = all.find((i) => i.id === id);
            if (!item) return null;
            const on = id === active;
            return (
              <li key={id} className="flex-1">
                <button
                  type="button"
                  onClick={() => go(id)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex w-full flex-col items-center gap-0.5 rounded-pill py-1.5 text-[11px] font-bold transition-colors",
                    on ? "bg-ink text-cloth" : "text-muted-foreground",
                  )}
                >
                  <item.icon className={cn("h-5 w-5", on && "text-leaf")} />
                  {item.short ?? item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default DashboardShell;
