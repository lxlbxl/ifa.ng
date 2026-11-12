import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Crown, Repeat, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/brand";
import { Panel, PanelHeader, EmptyState } from "@/components/dashboard/shell/Panel";
import {
  useUserDirectory, useUserInsights,
  type DirectoryRow, type Insights, type SortKey, type UserTag,
} from "@/hooks/useAdminUserRecords";
import { naira } from "@/lib/ebo";
import { cn } from "@/lib/utils";
import AdminUserDetail from "./AdminUserDetail";
import { ago, initials, RoleChips, shortDate, TagChip } from "./userParts";

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "high_value", label: "High value" },
  { value: "frequent", label: "Frequent" },
  { value: "lapsed", label: "Lapsed" },
  { value: "one_time", label: "Booked once" },
  { value: "never_booked", label: "Never booked" },
  { value: "new", label: "New" },
  { value: "clients", label: "Clients" },
  { value: "babalawos", label: "Babalawos" },
  { value: "admins", label: "Admins" },
  { value: "disputes", label: "Open dispute" },
  { value: "suspended", label: "Suspended" },
  { value: "deleted", label: "Deleted" },
];
const SORTS: { value: SortKey; label: string }[] = [
  { value: "spend", label: "Lifetime spend" },
  { value: "spend_90d", label: "Spend, last 90 days" },
  { value: "bookings", label: "Total bookings" },
  { value: "bookings_90d", label: "Bookings, last 90 days" },
  { value: "frequency", label: "Books most often" },
  { value: "last_booking", label: "Last booking" },
  { value: "last_active", label: "Last active" },
  { value: "joined", label: "Date joined" },
  { value: "wallet", label: "Wallet balance" },
  { value: "name", label: "Name" },
];
const PAGE = 25;

// ------------------------------------------------------------------ insights
function InsightsBlock({ i, onOpen, onFilter }: { i?: Insights; onOpen: (id: string) => void; onFilter: (f: string) => void }) {
  const freq = i?.frequency;
  const buckets: [string, number, string][] = freq ? [
    ["Never", freq.none, "never_booked"], ["Once", freq.once, "one_time"], ["2–3", freq.two_to_three, ""],
    ["4–9", freq.four_to_nine, ""], ["10+", freq.ten_plus, ""],
  ] : [];
  const maxB = Math.max(1, ...buckets.map((b) => b[1]));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile tone="ink" label="People" value={i?.total ?? "…"} hint={i ? `${i.clients} clients · ${i.babalawos} Babalawos · ${i.new_30d} new this month` : undefined} />
        <StatTile tone="sun" label="Lifetime spend" value={i ? naira(i.lifetime_spend) : "…"} hint={i ? `${naira(i.spend_90d)} in the last 90 days` : undefined} />
        <StatTile tone="leaf" label="Paying clients" value={i?.payers ?? "…"} hint={i ? `${naira(i.avg_spend_per_payer)} average each` : undefined} />
        <StatTile tone="indigo" label="Come back" value={i ? `${i.repeat_rate}%` : "…"}
          hint={i ? (i.median_days_between != null ? `book again; typically every ${Math.round(i.median_days_between)} days` : "of clients book more than once") : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <PanelHeader eyebrow={<span className="inline-flex items-center gap-1.5"><Crown className="h-3.5 w-3.5" /> High value</span>} title="Top spenders"
            action={i?.tags.high_value ? <Button size="sm" variant="outline" onClick={() => onFilter("high_value")}>All {i.tags.high_value}</Button> : undefined} />
          {i && i.top_spenders.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
          <ol className="space-y-1">
            {i?.top_spenders.map((u, n) => (
              <li key={u.id}>
                <button type="button" onClick={() => onOpen(u.id)} className="flex w-full items-center gap-3 rounded-field px-2 py-2 text-left hover:bg-cloth">
                  <span className="w-4 text-sm font-bold text-muted-foreground">{n + 1}</span>
                  <Avatar className="h-8 w-8"><AvatarImage src={u.avatar_url ?? ""} /><AvatarFallback className="bg-sun text-xs font-bold text-ink">{initials(u.full_name)}</AvatarFallback></Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{u.full_name || "Unnamed"}</span>
                  <span className="text-right text-sm"><b>{naira(u.lifetime_spend)}</b><span className="block text-xs text-muted-foreground">{u.bookings_total} bookings</span></span>
                </button>
              </li>
            ))}
          </ol>
          {i && i.tags.high_value ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {i.tags.high_value} high-value {i.tags.high_value === 1 ? "person brings" : "people bring"} {i.top_spend_share}% of all spend.
              High value = {naira(i.thresholds.high_value_naira)}+ or the top 10% of payers.
            </p>
          ) : null}
        </Panel>

        <Panel>
          <PanelHeader eyebrow={<span className="inline-flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5" /> Frequency</span>} title="Most bookings, 90 days"
            action={i?.tags.frequent ? <Button size="sm" variant="outline" onClick={() => onFilter("frequent")}>All {i.tags.frequent}</Button> : undefined} />
          {i && i.most_frequent.length === 0 && <p className="text-sm text-muted-foreground">No bookings in the last 90 days.</p>}
          <ol className="space-y-1">
            {i?.most_frequent.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => onOpen(u.id)} className="flex w-full items-center gap-3 rounded-field px-2 py-2 text-left hover:bg-cloth">
                  <Avatar className="h-8 w-8"><AvatarImage src={u.avatar_url ?? ""} /><AvatarFallback className="bg-leaf text-xs font-bold text-ink">{initials(u.full_name)}</AvatarFallback></Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{u.full_name || "Unnamed"}</span>
                  <span className="text-right text-sm"><b>{u.bookings_90d}</b> in 90d
                    <span className="block text-xs text-muted-foreground">{u.avg_days_between != null ? `every ~${Math.round(u.avg_days_between)} days` : `${u.bookings_total} in total`}</span></span>
                </button>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="How often people book" title="Bookings per person" />
          <div className="space-y-2.5">
            {buckets.map(([label, n, f]) => (
              <button key={label} type="button" disabled={!f} onClick={() => f && onFilter(f)}
                className={cn("flex w-full items-center gap-3 text-left text-sm", f && "hover:opacity-80")}>
                <span className="w-12 font-semibold">{label}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-pill bg-cloth">
                  <span className="block h-full rounded-pill bg-teal" style={{ width: `${(n / maxB) * 100}%` }} />
                </span>
                <span className="w-8 text-right font-bold">{n}</span>
              </button>
            ))}
          </div>
          {i && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {(["lapsed", "new", "disputes"] as UserTag[]).filter((t) => i.tags[t]).map((t) => (
                <button key={t} type="button" onClick={() => onFilter(t)} className="hover:opacity-80"><TagChip tag={t} /> <b className="ml-0.5">{i.tags[t]}</b></button>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ list
const UserCard = ({ u, onOpen }: { u: DirectoryRow; onOpen: () => void }) => (
  <button type="button" onClick={onOpen}
    className="flex w-full items-start gap-3 rounded-panel border border-line bg-paper p-4 text-left transition-colors hover:border-ink/40 active:bg-cloth">
    <Avatar className="h-11 w-11 flex-none"><AvatarImage src={u.avatar_url ?? ""} /><AvatarFallback className="bg-leaf font-bold text-ink">{initials(u.full_name)}</AvatarFallback></Avatar>
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="line-clamp-2 break-words font-bold leading-snug">{u.full_name || "Unnamed"}</div>
          <div className="truncate text-xs text-muted-foreground">{u.phone || u.email || "No contact"}</div>
        </div>
        {u.roles.includes("babalawo") && u.lifetime_spend === 0 ? (
          <div className="flex-none text-right">
            <div className="font-display text-lg font-extrabold leading-none">{naira(u.babalawo_lifetime_earned)}</div>
            <div className="mt-1 text-xs text-muted-foreground">earned · {u.babalawo_sessions} given</div>
          </div>
        ) : (
          <div className="flex-none text-right">
            <div className="font-display text-lg font-extrabold leading-none">{naira(u.lifetime_spend)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{u.bookings_total} booking{u.bookings_total === 1 ? "" : "s"}</div>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <RoleChips roles={u.roles} suspended={u.is_suspended} deleted={u.is_deleted} />
        {u.tags.map((t) => <TagChip key={t} tag={t} />)}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">Active {ago(u.last_active_at)} · Last booked {ago(u.last_booking_at)}</div>
    </div>
    <ChevronRight className="mt-3 h-4 w-4 flex-none text-muted-foreground" />
  </button>
);

function SortHead({ k, label, sort, desc, onSort, className }: { k: SortKey; label: string; sort: SortKey; desc: boolean; onSort: (k: SortKey) => void; className?: string }) {
  const active = sort === k;
  return (
    <th className={cn("px-3 py-3 font-semibold", className)} aria-sort={active ? (desc ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
        {label}{active && (desc ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />)}
      </button>
    </th>
  );
}

const UserManagement = () => {
  const [params, setParams] = useSearchParams();
  const openId = params.get("user");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState(params.get("filter") ?? "all");
  const [sort, setSort] = useState<SortKey>("spend");
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(0), [debounced, filter, sort, desc]);

  const insights = useUserInsights();
  const list = useUserDirectory({ search: debounced, filter, sort, desc, page, pageSize: PAGE });
  const rows = list.data ?? [];
  const total = rows[0]?.total_count ?? 0;

  const open = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("user", id);
    setParams(next);
    window.scrollTo({ top: 0 });
  };
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("user");
    setParams(next);
  };
  const onSort = (k: SortKey) => { if (k === sort) setDesc(!desc); else { setSort(k); setDesc(k !== "name"); } };
  const pickFilter = (f: string) => { setFilter(f); document.getElementById("user-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  if (openId) return <AdminUserDetail userId={openId} onBack={close} onOpen={open} />;

  return (
    <div className="space-y-6">
      {insights.error
        ? <p className="text-sm text-camwood">Could not load insights: {(insights.error as Error).message}</p>
        : <InsightsBlock i={insights.data} onOpen={open} onFilter={pickFilter} />}

      <Panel id="user-list" className="scroll-mt-4 p-4 sm:p-6">
        <PanelHeader eyebrow="Tap anyone to see their record" title={`People${list.data ? ` (${total})` : ""}`} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" aria-label="Search people" />
          </div>
          <div className="flex gap-2">
            <Select value={sort} onValueChange={(v) => { setSort(v as SortKey); setDesc(v !== "name"); }}>
              <SelectTrigger className="w-full sm:w-[210px]" aria-label="Sort by"><SelectValue /></SelectTrigger>
              <SelectContent>{SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="flex-none" onClick={() => setDesc(!desc)} aria-label={desc ? "Highest first" : "Lowest first"}>
              {desc ? <ArrowDown /> : <ArrowUp />}
            </Button>
          </div>
        </div>
        <div className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2 pb-1 sm:w-auto sm:flex-wrap">
            {FILTERS.map((f) => (
              <button key={f.value} type="button" onClick={() => setFilter(f.value)} aria-pressed={filter === f.value}
                className={cn("inline-flex h-9 items-center rounded-pill px-3.5 text-sm font-bold transition-colors",
                  filter === f.value ? "bg-ink text-cloth" : "border border-line bg-paper hover:border-ink/40")}>
                {f.label}
                {insights.data?.tags[f.value as UserTag] ? <span className="ml-1.5 opacity-70">{insights.data.tags[f.value as UserTag]}</span> : null}
              </button>
            ))}
          </div>
        </div>

        {list.error && <p className="py-6 text-center text-camwood">Could not load people: {(list.error as Error).message}</p>}
        {list.isLoading && <p className="py-10 text-center text-muted-foreground">Loading people…</p>}
        {list.data && rows.length === 0 && (
          <EmptyState className="mt-4" icon={<Users />} title="Nobody here">Try another filter or search.</EmptyState>
        )}

        {rows.length > 0 && (
          <>
            {/* Phone: cards */}
            <div className={cn("mt-4 space-y-2.5 lg:hidden", list.isFetching && "opacity-60")}>
              {rows.map((u) => <UserCard key={u.id} u={u} onOpen={() => open(u.id)} />)}
            </div>
            {/* Desktop: table */}
            <div className={cn("mt-4 hidden overflow-x-auto lg:block", list.isFetching && "opacity-60")}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted-foreground">
                    <SortHead k="name" label="Person" sort={sort} desc={desc} onSort={onSort} />
                    <th className="px-3 py-3 font-semibold">Labels</th>
                    <SortHead k="spend" label="Spend" sort={sort} desc={desc} onSort={onSort} className="text-right" />
                    <SortHead k="bookings" label="Bookings" sort={sort} desc={desc} onSort={onSort} className="text-right" />
                    <SortHead k="frequency" label="Books every" sort={sort} desc={desc} onSort={onSort} className="text-right" />
                    <SortHead k="last_booking" label="Last booked" sort={sort} desc={desc} onSort={onSort} />
                    <SortHead k="last_active" label="Last active" sort={sort} desc={desc} onSort={onSort} />
                    <SortHead k="joined" label="Joined" sort={sort} desc={desc} onSort={onSort} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} tabIndex={0} role="link" onClick={() => open(u.id)} onKeyDown={(e) => e.key === "Enter" && open(u.id)}
                      className="cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-cloth focus-visible:bg-cloth focus-visible:outline-none">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9"><AvatarImage src={u.avatar_url ?? ""} /><AvatarFallback className="bg-leaf text-xs font-bold text-ink">{initials(u.full_name)}</AvatarFallback></Avatar>
                          <div className="min-w-0">
                            <div className="truncate font-bold">{u.full_name || "Unnamed"}</div>
                            <div className="truncate text-xs text-muted-foreground">{u.phone || u.email || "No contact"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3"><div className="flex max-w-[260px] flex-wrap gap-1"><RoleChips roles={u.roles} suspended={u.is_suspended} deleted={u.is_deleted} />{u.tags.map((t) => <TagChip key={t} tag={t} />)}</div></td>
                      <td className="px-3 py-3 text-right">
                        <b>{naira(u.lifetime_spend)}</b>
                        {u.spend_90d > 0 && <div className="text-xs text-muted-foreground">{naira(u.spend_90d)} in 90d</div>}
                        {u.roles.includes("babalawo") && u.babalawo_lifetime_earned > 0 && <div className="text-xs text-muted-foreground">earned {naira(u.babalawo_lifetime_earned)}</div>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <b>{u.bookings_total}</b>{u.bookings_90d > 0 && <div className="text-xs text-muted-foreground">{u.bookings_90d} in 90d</div>}
                        {u.roles.includes("babalawo") && <div className="text-xs text-muted-foreground">{u.babalawo_sessions} given</div>}
                      </td>
                      <td className="px-3 py-3 text-right">{u.avg_days_between != null ? `${Math.round(u.avg_days_between)} days` : "—"}</td>
                      <td className="px-3 py-3">{ago(u.last_booking_at)}</td>
                      <td className="px-3 py-3">{ago(u.last_active_at)}</td>
                      <td className="px-3 py-3 text-muted-foreground">{shortDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{page * PAGE + 1}–{page * PAGE + rows.length} of {total}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /> Previous</Button>
                <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>Next <ChevronRight /></Button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
};

export default UserManagement;
