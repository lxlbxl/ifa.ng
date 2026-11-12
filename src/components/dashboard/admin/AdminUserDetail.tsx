import React, { useState } from "react";
import {
  ArrowLeft, Ban, Check, CheckCircle2, EyeOff, Percent, Power, Star, X, Download, LogOut, MessageSquare, MoreHorizontal, Pin, PinOff, ShieldCheck, ShieldOff,
  StickyNote, Trash2, Wallet,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatTile } from "@/components/brand";
import { Panel, PanelHeader } from "@/components/dashboard/shell/Panel";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSetUserRole, useSetUserSuspended, useAdminRefundSession, useReviewBabalawo } from "@/hooks/useAdminActions";
import BabalawoCommissionModal from "./BabalawoCommissionModal";
import {
  exportUserData, useAddUserNote, useSetBabalawoListing, useAdjustUserWallet, useMessageUser, type Provider, useSignOutUser, useUpdateUserNote, useUserDetail,
  type UserDetail,
} from "@/hooks/useAdminUserRecords";
import { downloadJson, requestLabel } from "@/lib/privacy";
import { naira } from "@/lib/ebo";
import { cn } from "@/lib/utils";
import { ago, initials, RoleChips, shortDate, TagChip } from "./userParts";

const when = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const words = (s?: string | null) => (s ?? "").replace(/_/g, " ");
const pct = (n?: number | null, of?: number | null) => (of ? `${Math.round((100 * Number(n ?? 0)) / of)}%` : "—");
const duration = (from: string, to: string | null) => {
  const m = Math.max(0, Math.round(((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim();
};

const STATUS_TONE: Record<string, string> = {
  completed: "bg-leaf text-ink", confirmed: "bg-[#b9c4f2] text-ink", pending: "bg-sun/70 text-ink", in_progress: "bg-teal text-white",
  cancelled: "bg-cloth text-muted-foreground border border-line", refunded: "bg-cloth text-ink border border-line", paid: "bg-leaf text-ink",
  open: "bg-coral text-white", investigating: "bg-sun/70 text-ink", resolved_refund: "bg-leaf text-ink", resolved_dismissed: "bg-cloth text-ink border border-line",
  disputed: "bg-coral text-white", listed: "bg-leaf text-ink", hidden: "bg-cloth text-muted-foreground border border-line", sent: "bg-sun/70 text-ink", performed: "bg-[#b9c4f2] text-ink", failed: "bg-coral text-white",
};
const Pill = ({ s }: { s?: string | null }) => (
  <span className={cn("inline-flex h-6 items-center whitespace-nowrap rounded-pill px-2.5 text-[11px] font-bold capitalize", STATUS_TONE[s ?? ""] ?? "bg-cloth text-ink border border-line")}>
    {words(s) || "—"}
  </span>
);

/** A list that is a table on desktop and stacked rows on a phone. */
function Rows<T>({ items, empty, cols, render }: {
  items: T[]; empty: string; cols: string[]; render: (x: T) => React.ReactNode[];
}) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted-foreground">
            {cols.map((c) => <th key={c} className="px-3 py-2.5 font-semibold">{c}</th>)}
          </tr></thead>
          <tbody>{items.map((x, i) => (
            <tr key={i} className="border-b border-line/70 align-top last:border-0">{render(x).map((c, j) => <td key={j} className="px-3 py-2.5">{c}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
      <div className="space-y-2 md:hidden">
        {items.map((x, i) => {
          const cells = render(x);
          return (
            <div key={i} className="rounded-field border border-line bg-paper p-3 text-sm">
              {cells.map((c, j) => (
                <div key={j} className="flex items-start justify-between gap-3 py-0.5">
                  <span className="text-xs text-muted-foreground">{cols[j]}</span><span className="text-right">{c}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

const KV = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 border-b border-line/70 py-2 text-sm last:border-0">
    <span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span>
  </div>
);

// ------------------------------------------------------------------ dialogs
type DialogKind = null | "message" | "note" | "suspend" | "wallet" | "signout" | "admin";

function ActionDialogs({ kind, onClose, d, userId }: { kind: DialogKind; onClose: () => void; d: UserDetail; userId: string }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pinned, setPinned] = useState(false);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"credit" | "debit">("credit");
  const [provider, setProvider] = useState<Provider | null>(null);
  const message = useMessageUser();
  const note = useAddUserNote();
  const suspend = useSetUserSuspended();
  const wallet = useAdjustUserWallet();
  const signOut = useSignOutUser();
  const setRole = useSetUserRole();
  const name = d.stats.full_name || "this person";
  const done = () => { setTitle(""); setText(""); setAmount(""); setPinned(false); onClose(); };
  const amt = Number(amount);

  return (
    <>
      <Dialog open={kind === "message"} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message {name}</DialogTitle>
            <DialogDescription>Shows in their notifications and as a push alert if they turned those on. Logged in the admin activity.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="msg-title">Title</Label><Input id="msg-title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="About your booking" /></div>
            <div><Label htmlFor="msg-body">Message</Label><Textarea id="msg-body" maxLength={1000} rows={4} value={text} onChange={(e) => setText(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="sun" disabled={!title.trim() || !text.trim() || message.isPending}
              onClick={() => message.mutate({ userId, title: title.trim(), message: text.trim() }, { onSuccess: done })}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={kind === "note"} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a note about {name}</DialogTitle>
            <DialogDescription>Only admins see notes. Keep them factual: if {name} asks for a copy of their data, notes are included.</DialogDescription>
          </DialogHeader>
          <Textarea rows={5} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Called about a refund on 12 Nov; agreed to rebook." />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin to the top</label>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="sun" disabled={!text.trim() || note.isPending}
              onClick={() => note.mutate({ userId, body: text.trim(), pinned }, { onSuccess: done })}>Save note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={kind === "suspend"} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {name}?</DialogTitle>
            <DialogDescription>They are signed out on every device and cannot sign in, book or take bookings. Babalawos are hidden from search. You can reinstate them later.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason (only admins see this)" value={text} onChange={(e) => setText(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" disabled={!text.trim() || suspend.isPending}
              onClick={() => suspend.mutate({ userId, suspended: true, reason: text.trim() }, { onSuccess: done })}>Suspend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={kind === "wallet"} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust {name}'s wallet</DialogTitle>
            <DialogDescription>Balance now {naira(d.wallet.balance)}. Every adjustment is recorded with your reason in the payment audit log.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              {(["credit", "debit"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
                  className={cn("h-10 flex-1 rounded-pill text-sm font-bold capitalize", type === t ? "bg-ink text-cloth" : "border border-line bg-paper")}>{t === "credit" ? "Add money" : "Take money"}</button>
              ))}
            </div>
            <div><Label htmlFor="w-amt">Amount (₦)</Label><Input id="w-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} /></div>
            {type === "credit" && <ProviderPicker value={provider} onChange={setProvider} />}
            <div><Label htmlFor="w-why">Reason</Label><Textarea id="w-why" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Goodwill credit for the dropped call on 10 Nov" /></div>
            {type === "debit" && amt > Number(d.wallet.balance) && <p className="text-sm text-camwood">That is more than the balance.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="sun" disabled={!(amt > 0) || text.trim().length < 3 || wallet.isPending || (type === "debit" && amt > Number(d.wallet.balance))
                || (type === "credit" && !provider)}
              onClick={() => wallet.mutate({ userId, amount: amt, type, reason: text.trim(), provider: provider ?? undefined }, { onSuccess: done })}>
              {type === "credit" ? `Add ${amount ? naira(amt) : ""}` : `Take ${amount ? naira(amt) : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={kind === "signout"} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign {name} out everywhere?</DialogTitle>
            <DialogDescription>Ends all {d.sign_ins.length} active sign-in{d.sign_ins.length === 1 ? "" : "s"}. They can sign in again with their phone and PIN. Use this if a phone was lost or shared.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" disabled={signOut.isPending} onClick={() => signOut.mutate({ userId }, { onSuccess: done })}>Sign out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={kind === "admin"} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make {name} an admin?</DialogTitle>
            <DialogDescription>Admins can see everyone's records, move money and change settings. Only do this for staff.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" disabled={setRole.isPending} onClick={() => setRole.mutate({ userId, role: "admin", grant: true }, { onSuccess: done })}>Make admin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ------------------------------------------------------------------ Babalawo practice
function BabalawoPractice({ d, userId, name }: { d: UserDetail; userId: string; name: string }) {
  const b = d.babalawo!;
  const pr = d.practice;
  const review = useReviewBabalawo();
  const listing = useSetBabalawoListing();
  const [reject, setReject] = useState<null | "rejected" | "suspended">(null);
  const [reason, setReason] = useState("");
  const [commission, setCommission] = useState(false);
  const app = pr.application;
  const prof = pr.profile;
  const status = b.review_status ?? "pending";
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel>
          <PanelHeader eyebrow="Listing" title={<span className="capitalize">{words(status)}</span>}
            action={<Pill s={b.is_active ? "listed" : "hidden"} />} />
          <p className="text-sm text-muted-foreground">
            {status === "approved" ? `Verified${b.reviewed_at ? ` ${shortDate(b.reviewed_at)}` : ""}${prof?.reviewed_by ? ` by ${prof.reviewed_by}` : ""}. Clients can find and book ${name}.`
              : status === "pending" ? `${name} is waiting for review and is hidden from clients.`
              : `${name} is hidden from clients.`}
            {b.review_notes && <span className="mt-1 block">Note: {b.review_notes}</span>}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {status !== "approved" && <Button variant="sun" disabled={review.isPending} onClick={() => review.mutate({ userId, status: "approved" })}><Check /> Approve</Button>}
            {status !== "rejected" && status !== "approved" && <Button variant="outline" onClick={() => { setReason(""); setReject("rejected"); }}><X /> Reject</Button>}
            {status === "approved" && <Button variant="outline" className="text-camwood" onClick={() => { setReason(""); setReject("suspended"); }}><EyeOff /> Hide from clients</Button>}
            <Button variant="outline" disabled={listing.isPending} onClick={() => listing.mutate({ userId, featured: !prof?.is_featured })}>
              <Star /> {prof?.is_featured ? "Unfeature" : "Feature"}
            </Button>
            {b.current_status && b.current_status !== "offline" && (
              <Button variant="outline" disabled={listing.isPending} onClick={() => listing.mutate({ userId, takeOffline: true })}><Power /> Set offline</Button>
            )}
            <Button variant="outline" onClick={() => setCommission(true)}><Percent /> Commission</Button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
            <KV k="Scheduled price" v={naira(b.session_price)} />
            <KV k="Consult now" v={naira(b.instant_price)} />
            <KV k="Their share" v={b.commission_babalawo_percent != null ? `${b.commission_babalawo_percent}%` : "Default"} />
            <KV k="Experience" v={prof?.experience_years ? `${prof.experience_years} years` : "—"} />
            <KV k="Location" v={[b.city, b.country].filter(Boolean).join(", ") || "—"} />
            <KV k="Meet account" v={prof?.google_email ? "Linked" : "Not linked"} />
          </div>
          {(prof?.specialties?.length || prof?.languages?.length) ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[...(prof?.specialties ?? []), ...(prof?.languages ?? [])].map((t) => (
                <span key={t} className="inline-flex h-6 items-center rounded-pill border border-line bg-cloth px-2.5 text-[11px] font-bold">{t}</span>
              ))}
            </div>
          ) : null}
          {prof?.bio && <p className="mt-3 whitespace-pre-wrap text-sm">{prof.bio}</p>}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="How they work" title="Performance" />
          <KV k="Consultations completed" v={`${pr.completed} of ${pr.completed + pr.cancelled} (${pct(pr.completed, pr.completed + pr.cancelled)})`} />
          <KV k="Upcoming, paid" v={pr.upcoming} />
          <KV k="Did not show up" v={<span className={cn(pr.no_shows > 0 && "text-camwood")}>{pr.no_shows}</span>} />
          <KV k="Consult Now answered" v={pr.instant_offered ? `${pr.instant_accepted} of ${pr.instant_offered} (${pct(pr.instant_accepted, pr.instant_offered)})` : "None yet"} />
          <KV k="Clients" v={`${pr.unique_clients} (${pr.repeat_clients} came back)`} />
          <KV k="Rating" v={pr.rating_avg != null ? `${Number(pr.rating_avg).toFixed(1)}★ from ${pr.reviews_count}` : "No reviews"} />
          <KV k="Earned, 90 days" v={naira(pr.gross_90d)} />
          <KV k="Available to withdraw" v={`${naira(b.wallet?.available)} (${naira(b.wallet?.pending)} pending)`} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow={`${Math.round(Number(pr.online_hours_30d))}h over ${pr.online_days_30d} days in the last 30`} title="Online history" />
          {pr.presence.length === 0 && <p className="text-sm text-muted-foreground">No Online time recorded yet. History starts from this update.</p>}
          <ul className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
            {pr.presence.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-field border border-line px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", p.ended_at ? "bg-line" : p.status === "busy" ? "bg-sun" : "bg-leaf")} />
                  <span className="capitalize">{p.status}</span>
                  <span className="text-muted-foreground">{when(p.started_at)}</span>
                </span>
                <span className="font-semibold">{p.ended_at ? duration(p.started_at, p.ended_at) : "Now"}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader eyebrow="What they sent when applying" title="Application" />
          {!app && <p className="text-sm text-muted-foreground">No application on file (added by an admin or before the waitlist).</p>}
          {app && (
            <>
              <KV k="Applied" v={shortDate(app.created_at)} />
              <KV k="Decision" v={<span><span className="capitalize">{words(app.status)}</span>{app.reviewed_at ? ` · ${shortDate(app.reviewed_at)}` : ""}{app.reviewed_by_name ? ` by ${app.reviewed_by_name}` : ""}</span>} />
              <KV k="Ilé" v={app.ile_name || "—"} />
              <KV k="Practising" v={app.years_practising != null ? `${app.years_practising} years` : "—"} />
              <KV k="Consults online already" v={<span className="capitalize">{app.consults_online || "—"}</span>} />
              <KV k="Heard about us" v={app.referral || "—"} />
              {app.review_notes && <KV k="Review note" v={app.review_notes} />}
              {app.bio && <p className="mt-3 whitespace-pre-wrap text-sm">{app.bio}</p>}
            </>
          )}
        </Panel>
      </div>

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reject === "rejected" ? `Reject ${name}?` : `Hide ${name} from clients?`}</DialogTitle>
            <DialogDescription>{name} gets a notification with your reason. Paid bookings already made are not cancelled.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!reason.trim() || review.isPending}
              onClick={() => reject && review.mutate({ userId, status: reject, notes: reason.trim() }, { onSuccess: () => setReject(null) })}>
              {reject === "rejected" ? "Reject" : "Hide"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BabalawoCommissionModal open={commission} onOpenChange={setCommission} babalawoId={userId} babalawoName={name} />
    </div>
  );
}

// ------------------------------------------------------------------ page
const AdminUserDetail = ({ userId, onBack, onOpen, backLabel = "All people" }: {
  userId: string; onBack: () => void; onOpen: (id: string) => void; backLabel?: string;
}) => {
  const { user: me } = useAuth();
  const { data: d, isLoading, error } = useUserDetail(userId);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const setRole = useSetUserRole();
  const suspend = useSetUserSuspended();
  const updateNote = useUpdateUserNote();
  const refund = useAdminRefundSession();
  const [exporting, setExporting] = useState(false);

  const back = (
    <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft /> {backLabel}</Button>
  );
  if (isLoading) return <div className="space-y-4">{back}<p className="py-16 text-center text-muted-foreground">Loading record…</p></div>;
  if (error || !d) return <div className="space-y-4">{back}<p className="py-16 text-center text-camwood">Could not load this person: {(error as Error)?.message ?? "not found"}</p></div>;

  const s = d.stats;
  const pr = d.practice;
  const isMe = me?.id === userId;
  const roles = s.roles;
  const isBaba = roles.includes("babalawo");
  const deleted = s.is_deleted;
  const clientSessions = d.sessions.filter((x) => x.as_role === "client");
  const babaSessions = d.sessions.filter((x) => x.as_role === "babalawo");
  const upcomingPaid = (x: UserDetail["sessions"][number]) => ["pending", "confirmed", "in_progress"].includes(x.status) && x.payment_status === "paid";

  const doExport = async () => {
    setExporting(true);
    try {
      downloadJson(await exportUserData(userId), `ifa-user-${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`);
      toast({ title: "Export downloaded", description: "Logged in the admin activity." });
    } catch (e) {
      toast({ title: "Export failed", description: (e as Error).message, variant: "destructive" });
    } finally { setExporting(false); }
  };

  const sessionCols = ["When", "With", "Type", "Status", "Payment", "Amount", ""];
  const sessionRow = (x: UserDetail["sessions"][number]) => [
    <span key="w">{when(x.starts_at ?? x.created_at)}<span className="block text-xs text-muted-foreground">#{x.id} · booked {shortDate(x.created_at)}</span></span>,
    <button key="o" type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => onOpen(x.other_id)}>{x.other_name || "—"}</button>,
    <span key="t">{x.session_type === "ebo_ritual" ? "Ebo ritual" : x.is_instant ? "Consult now" : "Scheduled"}{x.no_show && <span className="block text-xs text-camwood">Babalawo no-show</span>}</span>,
    <Pill key="s" s={x.status} />,
    <Pill key="p" s={x.payment_status} />,
    <b key="a">{x.amount != null ? naira(x.amount) : "—"}</b>,
    upcomingPaid(x) ? (
      <Button key="r" size="sm" variant="outline" disabled={refund.isPending}
        onClick={() => {
          const reason = window.prompt(`Cancel session #${x.id} and refund in full? Write the reason:`);
          if (reason?.trim()) refund.mutate({ sessionId: x.id, reason: reason.trim() });
        }}>Cancel + refund</Button>
    ) : <span key="r" />,
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">{back}
        <span className="text-xs text-muted-foreground">Opening a record is logged as access to personal data.</span>
      </div>

      {/* Header */}
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar className="h-16 w-16 flex-none sm:h-20 sm:w-20">
              <AvatarImage src={s.avatar_url ?? ""} />
              <AvatarFallback className="bg-sun font-display text-2xl font-extrabold text-ink">{initials(s.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] sm:text-4xl">{s.full_name || "Unnamed"}{isMe && <span className="text-muted-foreground"> (you)</span>}</h2>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {s.phone && <a href={`tel:${s.phone}`} className="hover:text-ink">{s.phone}</a>}
                {s.email && <a href={`mailto:${s.email}`} className="break-all hover:text-ink">{s.email}</a>}
                <span>Joined {shortDate(s.created_at)}</span>
                <span>Active {ago(s.last_active_at)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <RoleChips roles={roles} suspended={s.is_suspended} deleted={deleted} />
                {s.tags.map((t) => <TagChip key={t} tag={t} />)}
              </div>
              {s.is_suspended && <p className="mt-2 text-sm text-camwood">Suspended {shortDate(s.suspended_at)}{s.suspended_reason ? `: ${s.suspended_reason}` : ""}</p>}
            </div>
          </div>

          {!deleted && (
            <div className="flex flex-wrap gap-2 lg:max-w-[420px] lg:justify-end">
              <Button variant="sun" onClick={() => setDialog("message")}><MessageSquare /> Message</Button>
              <Button variant="outline" onClick={() => setDialog("note")}><StickyNote /> Add note</Button>
              {s.is_suspended ? (
                <Button variant="outline" disabled={suspend.isPending} onClick={() => suspend.mutate({ userId, suspended: false })}><CheckCircle2 /> Reinstate</Button>
              ) : (
                <Button variant="outline" className="text-camwood" disabled={isMe} onClick={() => setDialog("suspend")}><Ban /> Suspend</Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onClick={() => setDialog("wallet")}><Wallet className="mr-2 h-4 w-4" />Adjust wallet</DropdownMenuItem>
                  <DropdownMenuItem disabled={isMe || d.sign_ins.length === 0} onClick={() => setDialog("signout")}><LogOut className="mr-2 h-4 w-4" />Sign out everywhere</DropdownMenuItem>
                  <DropdownMenuItem disabled={exporting} onClick={doExport}><Download className="mr-2 h-4 w-4" />Download their data (JSON)</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {isBaba ? (
                    <DropdownMenuItem disabled={setRole.isPending} onClick={() => setRole.mutate({ userId, role: "babalawo", grant: false })}><ShieldOff className="mr-2 h-4 w-4" />Remove Babalawo role</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem disabled={setRole.isPending} onClick={() => setRole.mutate({ userId, role: "babalawo", grant: true })}><ShieldCheck className="mr-2 h-4 w-4" />Grant Babalawo role</DropdownMenuItem>
                  )}
                  {roles.includes("admin") ? (
                    <DropdownMenuItem disabled={isMe || setRole.isPending} onClick={() => setRole.mutate({ userId, role: "admin", grant: false })}><ShieldOff className="mr-2 h-4 w-4" />Remove admin</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => setDialog("admin")}><ShieldCheck className="mr-2 h-4 w-4" />Make admin</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </Panel>

      {/* Numbers */}
      {isBaba && d.babalawo && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile tone="ink" label="Sessions given" value={pr?.completed ?? s.babalawo_sessions}
            hint={`${pr?.sessions_90d ?? 0} in 90 days · ${pct(pr?.completed, (pr?.completed ?? 0) + (pr?.cancelled ?? 0))} completed`} />
          <StatTile tone="sun" label="Earned (lifetime)" value={naira(d.babalawo.wallet?.lifetime_earned)}
            hint={`${naira(pr?.gross_90d)} in 90 days · ${naira(d.babalawo.wallet?.lifetime_paid_out)} paid out`} />
          <StatTile tone="leaf" label="Rating" value={pr?.rating_avg != null ? `${Number(pr.rating_avg).toFixed(1)}★` : "—"}
            hint={`${pr?.reviews_count ?? 0} review${pr?.reviews_count === 1 ? "" : "s"} · ${pr?.repeat_clients ?? 0} of ${pr?.unique_clients ?? 0} clients came back`} />
          <StatTile tone="indigo" label="Online, 30 days" value={`${Math.round(Number(pr?.online_hours_30d ?? 0))}h`}
            hint={`${pr?.online_days_30d ?? 0} days · now ${words(d.babalawo.current_status) || "offline"} · seen ${ago(d.babalawo.last_seen_at)}`} />
        </div>
      )}
      {(!isBaba || s.bookings_total > 0) && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {isBaba && <p className="col-span-2 -mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground lg:col-span-4">As a client</p>}
          <StatTile tone={isBaba ? "paper" : "sun"} label="Lifetime spend" value={naira(s.lifetime_spend)}
            hint={`${naira(s.session_spend)} sessions · ${naira(s.ebo_spend)} Ebo${s.refunded > 0 ? ` · ${naira(s.refunded)} refunded` : ""}`} />
          <StatTile tone={isBaba ? "paper" : "leaf"} label="Bookings" value={s.bookings_total}
            hint={`${s.bookings_completed} completed · ${s.bookings_cancelled} cancelled · ${s.bookings_90d} in 90 days`} />
          <StatTile tone={isBaba ? "paper" : "indigo"} label="Books every" value={s.avg_days_between != null ? `${Math.round(s.avg_days_between)} days` : "—"}
            hint={s.last_booking_at ? `Last booked ${ago(s.last_booking_at)} · first ${shortDate(s.first_booking_at)}` : "No bookings yet"} />
          <StatTile tone="paper" label="Wallet" value={naira(d.wallet.balance)}
            hint={s.open_disputes ? `${s.open_disputes} open dispute${s.open_disputes === 1 ? "" : "s"}` : s.spend_rank > 0 ? `Top ${Math.max(1, Math.round((1 - s.spend_rank) * 100))}% of payers` : "No open disputes"} />
        </div>
      )}

      <Tabs defaultValue={isBaba ? "practice" : "overview"}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            {isBaba && <TabsTrigger value="practice">Practice</TabsTrigger>}
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bookings">Bookings ({d.sessions.length})</TabsTrigger>
            <TabsTrigger value="money">Payments & wallet</TabsTrigger>
            <TabsTrigger value="ebo">Ebo ({d.ebo.length})</TabsTrigger>
            <TabsTrigger value="disputes">Disputes & reviews</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </div>

        {isBaba && d.babalawo && pr && (
          <TabsContent value="practice" className="mt-4">
            <BabalawoPractice d={d} userId={userId} name={s.full_name || "this Babalawo"} />
          </TabsContent>
        )}

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <Panel>
              <PanelHeader eyebrow="Only admins see these" title="Notes" action={!deleted && <Button size="sm" variant="outline" onClick={() => setDialog("note")}><StickyNote /> Add</Button>} />
              {d.notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet. Add one after a call or a complaint so the next admin has the story.</p>}
              <ul className="space-y-2.5">
                {d.notes.map((n) => (
                  <li key={n.id} className={cn("rounded-field border p-3", n.pinned ? "border-sun bg-sun/15" : "border-line")}>
                    <p className="m-0 whitespace-pre-wrap text-sm">{n.body}</p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{n.author_name || "Admin"} · {when(n.created_at)}</span>
                      <span className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={n.pinned ? "Unpin" : "Pin"} onClick={() => updateNote.mutate({ noteId: n.id, pinned: !n.pinned })}>{n.pinned ? <PinOff /> : <Pin />}</Button>
                        {n.author_id === me?.id && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Delete note"
                            onClick={() => window.confirm("Delete this note?") && updateNote.mutate({ noteId: n.id, remove: true })}><Trash2 /></Button>
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel>
              <PanelHeader eyebrow="Account" title="Details" />
              <KV k="Phone confirmed" v={d.account?.phone_confirmed_at ? shortDate(d.account.phone_confirmed_at) : "No"} />
              <KV k="Last sign-in" v={when(d.account?.last_sign_in_at)} />
              <KV k="Signed in on" v={`${d.sign_ins.length} device${d.sign_ins.length === 1 ? "" : "s"}`} />
              <KV k="Signed up as" v={<span className="capitalize">{d.account?.signup_role || "client"}</span>} />
              <KV k="Roles" v={d.roles.map((r) => `${r.role}${r.granted_by ? ` (by ${r.granted_by})` : ""}`).join(", ") || "user"} />
              <KV k="Time zone" v={d.account?.timezone || "—"} />
              <KV k="WhatsApp / SMS" v={`${d.account?.whatsapp_opt_in ? "Yes" : "No"} / ${d.account?.sms_opt_in ? "Yes" : "No"}`} />
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="bookings" className="mt-4 space-y-4">
          {(clientSessions.length > 0 || !isBaba) && (
            <Panel>
              <PanelHeader eyebrow="As a client" title={`Consultations booked (${clientSessions.length})`} />
              <Rows items={clientSessions} empty="No bookings yet." cols={sessionCols} render={sessionRow} />
            </Panel>
          )}
          {isBaba && (
            <Panel>
              <PanelHeader eyebrow="As a Babalawo" title={`Consultations given (${babaSessions.length})`} />
              <Rows items={babaSessions} empty="No consultations yet." cols={sessionCols} render={sessionRow} />
            </Panel>
          )}
          <p className="text-xs text-muted-foreground">Odù readings, notes and recordings are private to the client and Babalawo and are not shown here.</p>
        </TabsContent>

        <TabsContent value="money" className="mt-4 space-y-4">
          <Panel>
            <PanelHeader eyebrow="Card, transfer and wallet" title={`Payments (${d.payments.length})`} />
            <Rows items={d.payments} empty="No payments." cols={["When", "For", "Method", "Status", "Amount", "Reference"]}
              render={(p) => [
                when(p.created_at),
                p.ebo_id ? "Ebo" : p.session_id ? `Session #${p.session_id}` : "—",
                <span key="m" className="capitalize">{p.payment_gateway || "—"}</span>,
                <Pill key="s" s={p.status} />,
                <span key="a"><b>{naira(p.amount)}</b>{Number(p.refunded_amount) > 0 && <span className="block text-xs text-camwood">−{naira(p.refunded_amount)} refunded</span>}</span>,
                <code key="r" className="break-all text-xs">{p.payment_reference || "—"}</code>,
              ]} />
          </Panel>
          <Panel>
            <PanelHeader eyebrow={`Balance ${naira(d.wallet.balance)}`} title="Wallet"
              action={!deleted && <Button size="sm" variant="outline" onClick={() => setDialog("wallet")}><Wallet /> Adjust</Button>} />
            <Rows items={d.wallet.transactions} empty="No wallet activity." cols={["When", "What", "Amount", "Balance after"]}
              render={(t) => [
                when(t.created_at),
                <span key="w"><span className="capitalize">{words(t.transaction_source)}</span>{t.description && <span className="block text-xs text-muted-foreground">{t.description}</span>}</span>,
                <b key="a" className={t.transaction_type === "credit" ? "text-green-700" : "text-camwood"}>{t.transaction_type === "credit" ? "+" : "−"}{naira(t.amount)}</b>,
                t.balance_after != null ? naira(t.balance_after) : "—",
              ]} />
          </Panel>
          {d.babalawo && d.babalawo.withdrawals.length > 0 && (
            <Panel>
              <PanelHeader eyebrow="Earnings" title="Withdrawals" />
              <Rows items={d.babalawo.withdrawals} empty="" cols={["When", "Amount", "Status"]}
                render={(w) => [when(w.created_at), <b key="a">{naira(w.amount)}</b>, <Pill key="s" s={w.status} />]} />
            </Panel>
          )}
        </TabsContent>

        <TabsContent value="ebo" className="mt-4">
          <Panel>
            <PanelHeader eyebrow="Ebo and Etutu" title="Quotes and rituals" />
            <Rows items={d.ebo} empty="No Ebo or Etutu." cols={["When", "What", "With", "Status", "Amount"]}
              render={(e) => [
                when(e.created_at),
                <span key="w"><span className="capitalize">{e.kind}</span>{e.title && <span className="block text-xs text-muted-foreground">{e.title}</span>}</span>,
                <span key="o">{e.other_name || "—"}<span className="block text-xs text-muted-foreground">{e.as_role === "client" ? "their Babalawo" : "client"}</span></span>,
                <Pill key="s" s={e.status} />,
                <b key="a">{naira(e.amount_due ?? e.total)}</b>,
              ]} />
          </Panel>
        </TabsContent>

        <TabsContent value="disputes" className="mt-4 space-y-4">
          <Panel>
            <PanelHeader eyebrow="Raised by them or on their sessions" title={`Disputes (${d.disputes.length})`} />
            <Rows items={d.disputes} empty="No disputes." cols={["When", "About", "Raised by", "Status", "Reason"]}
              render={(x) => [
                when(x.created_at),
                x.ebo_id ? "Ebo" : x.session_id ? `Session #${x.session_id}` : "—",
                x.raised_by_them ? "Them" : "The other side",
                <Pill key="s" s={x.status} />,
                <span key="r" className="block max-w-[44ch] text-left">{x.reason}{x.resolution_note && <span className="block text-xs text-muted-foreground">Outcome: {x.resolution_note}</span>}</span>,
              ]} />
          </Panel>
          <Panel>
            <PanelHeader eyebrow="Written and received" title={`Reviews (${d.reviews.length})`} />
            <Rows items={d.reviews} empty="No reviews." cols={["When", "", "Rating", "Comment"]}
              render={(r) => [
                when(r.created_at),
                `${r.direction === "wrote" ? "About" : "From"} ${r.other_name || "—"}`,
                <b key="r">{"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span></b>,
                <span key="c" className="block max-w-[44ch] text-left">{r.comment || "—"}{r.flagged && <span className="ml-1 text-xs text-camwood">flagged</span>}</span>,
              ]} />
          </Panel>
        </TabsContent>

        <TabsContent value="privacy" className="mt-4 space-y-4">
          <Panel>
            <PanelHeader eyebrow="NDPA / GDPR" title="Consents in force" />
            <Rows items={d.consents} empty="No consents recorded yet." cols={["Purpose", "Answer", "Notice version", "When"]}
              render={(c) => [
                <span key="p" className="capitalize">{words(c.purpose)}</span>,
                c.granted ? <span key="g" className="font-bold text-green-700">Given</span> : <span key="g" className="font-bold text-camwood">Refused / withdrawn</span>,
                c.notice_version || "—", when(c.created_at),
              ]} />
          </Panel>
          <Panel>
            <PanelHeader eyebrow="Access, correction, erasure…" title="Privacy requests"
              action={<Button size="sm" variant="outline" asChild><a href="/dashboard?section=privacy">Open privacy queue</a></Button>} />
            <Rows items={d.privacy_requests} empty="No privacy requests." cols={["Received", "Type", "Status", "Due", "Source"]}
              render={(r) => [when(r.received_at), requestLabel(r.request_type), <Pill key="s" s={r.status} />, shortDate(r.completed_at ?? r.due_at), words(r.source)]} />
            <p className="mt-3 text-xs text-muted-foreground">To delete this account, handle an erasure request in the privacy queue, so the safety checks and the legal record run.</p>
          </Panel>
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-4">
          <Panel>
            <PanelHeader eyebrow="Who did what to this account" title="Admin activity" />
            <Rows items={d.audit} empty="No admin activity yet." cols={["When", "Admin", "Action", "Details"]}
              render={(a) => [
                when(a.created_at), a.admin_name || "System",
                <span key="a" className="capitalize">{words(a.action)}</span>,
                <span key="d" className="block max-w-[48ch] break-words text-left text-xs text-muted-foreground">
                  {Object.entries(a.details ?? {}).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${words(k)}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ") || "—"}
                </span>,
              ]} />
          </Panel>
          <Panel>
            <PanelHeader eyebrow="Active sign-ins" title="Devices" />
            <Rows items={d.sign_ins} empty="Not signed in anywhere." cols={["Signed in", "Last used", "Device", "IP"]}
              render={(x) => [when(x.created_at), ago(x.updated_at ?? x.created_at),
                <span key="d" className="block max-w-[40ch] truncate text-left text-xs">{x.user_agent || "—"}</span>, x.ip_address || "—"]} />
          </Panel>
        </TabsContent>
      </Tabs>

      <ActionDialogs kind={dialog} onClose={() => setDialog(null)} d={d} userId={userId} />
    </div>
  );
};

export default AdminUserDetail;

/**
 * Money on IFA.ng sits in the Paystack or the Flutterwave balance, and a Babalawo is paid out by the
 * provider that holds it. A wallet credit must therefore say whose balance it comes from.
 */
export function ProviderPicker({ value, onChange }: { value: Provider | null; onChange: (p: Provider) => void }) {
  return (
    <div>
      <Label>Paid from which balance</Label>
      <div className="mt-1 flex gap-2">
        {(["paystack", "flutterwave"] as const).map((p) => (
          <button key={p} type="button" onClick={() => onChange(p)} aria-pressed={value === p}
            className={cn("h-10 flex-1 rounded-pill text-sm font-bold", value === p ? "bg-ink text-cloth" : "border border-line bg-paper")}>
            {p === "paystack" ? "Paystack" : "Flutterwave"}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Babalawos are paid from the same provider, so pick the balance this money really sits in.</p>
    </div>
  );
}
