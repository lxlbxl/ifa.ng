import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/integrations/api/config";
import { createPaymentIntent, openCheckout, verifyPayment, type PaymentGateway } from "@/utils/paymentGatewayUtils";

/** Ebo / Etutu: shared types, labels and calls. Every change goes through a database function. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type EboStatus =
  | "draft" | "sent" | "paid" | "in_progress" | "performed" | "completed"
  | "declined" | "expired" | "cancelled" | "refunded" | "disputed";

export interface EboItem {
  id?: string;
  catalog_item_id?: string | null;
  name: string;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  line_total?: number;
  position?: number;
}

export interface Ebo {
  id: string;
  session_id: number;
  babalawo_id: string;
  client_id: string;
  kind: "ebo" | "etutu" | "other";
  title: string;
  description: string | null;
  performed_by: "babalawo" | "client";
  due_date: string | null;
  status: EboStatus;
  owo_ifa: number;
  items_total: number;
  total: number;
  platform_fee_percent: number;
  platform_fee: number;
  amount_due: number;
  babalawo_amount: number | null;
  items_released: number;
  refunded_amount: number;
  version: number;
  ai_suggested: boolean;
  ritual_at: string | null;
  ritual_minutes: number;
  attendance: "present" | "absent" | null;
  ritual_session_id: number | null;
  sent_at: string | null;
  expires_at: string | null;
  paid_at: string | null;
  started_at: string | null;
  performed_at: string | null;
  performance_note: string | null;
  confirm_by: string | null;
  completed_at: string | null;
  decline_reason: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  ebo_items?: EboItem[];
}

export interface CatalogItem {
  id: string; name: string; english_name: string | null; unit: string | null;
  min_price: number | null; max_price: number | null; active: boolean; position: number;
}

export interface EboProof {
  id: string; kind: "video" | "photo"; status: "processing" | "ready" | "failed"; content_type: string;
  size_bytes: number; duration_seconds: number | null; url: string | null; created_at: string;
  check: { name_heard?: boolean | null; items_heard?: string[]; items_missing?: string[]; has_speech?: boolean; skipped?: string } | null;
}

export const KIND_LABEL: Record<Ebo["kind"], string> = { ebo: "Ebo", etutu: "Etutu", other: "Offering" };

export const STATUS_LABEL: Record<EboStatus, string> = {
  draft: "Draft", sent: "Awaiting payment", paid: "Paid", in_progress: "Started", performed: "Performed",
  completed: "Completed", declined: "Declined", expired: "Expired", cancelled: "Withdrawn", refunded: "Refunded", disputed: "Under review",
};
export const STATUS_STYLE: Record<EboStatus, string> = {
  draft: "bg-cloth text-ink border border-line", sent: "bg-sun text-ink", paid: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-indigo-100 text-indigo-800", performed: "bg-teal-100 text-teal-800", completed: "bg-leaf text-ink",
  declined: "bg-cloth text-muted-foreground", expired: "bg-cloth text-muted-foreground", cancelled: "bg-cloth text-muted-foreground",
  refunded: "bg-cloth text-ink", disputed: "bg-coral text-white",
};
/** A client-performed Ebo is guidance: "sent" means "to do", not "awaiting payment". */
export const statusLabel = (e: Pick<Ebo, "status" | "performed_by">) =>
  e.performed_by === "client" && e.status === "sent" ? "To do" : STATUS_LABEL[e.status];

export const naira = (n: number | string | null | undefined) =>
  `₦${Math.round(Number(n ?? 0)).toLocaleString("en-NG")}`;

export const when = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "";

/** <input type="datetime-local"> value <-> ISO instant in the browser's time zone. */
export const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const eboApi = {
  listForSession: async (sessionId: number): Promise<Ebo[]> => {
    const { data, error } = await db.from("ebo_prescriptions").select("*, ebo_items(*)").eq("session_id", sessionId).order("created_at");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  listForClient: async (clientId: string): Promise<Ebo[]> => {
    const { data, error } = await db.from("ebo_prescriptions").select("*, ebo_items(*)").eq("client_id", clientId)
      .not("status", "in", "(draft,cancelled)").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  catalog: async (all = false): Promise<CatalogItem[]> => {
    let q = db.from("ebo_catalog_items").select("*").order("position").order("name");
    if (!all) q = q.eq("active", true);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  feePercent: async (): Promise<number> => {
    const { data } = await db.from("admin_settings").select("setting_value").eq("setting_key", "ebo_platform_fee_percent").maybeSingle();
    return Number(data?.setting_value ?? 10);
  },
  saveDraft: (a: {
    id?: string | null; sessionId: number; kind: string; title: string; description: string; performedBy: string;
    dueDate: string | null; owoIfa: number; items: EboItem[]; ritualAt: string | null; ritualMinutes: number;
  }) => rpc<string>("ebo_save_draft", {
    p_id: a.id ?? null, p_session_id: a.sessionId, p_kind: a.kind, p_title: a.title, p_description: a.description,
    p_performed_by: a.performedBy, p_due_date: a.dueDate || null, p_owo_ifa: a.owoIfa, p_items: cleanItems(a.items),
    p_ritual_at: a.ritualAt, p_ritual_minutes: a.ritualMinutes,
  }),
  deleteDraft: (id: string) => rpc("ebo_delete_draft", { p_id: id }),
  send: (id: string) => rpc("ebo_send", { p_id: id }),
  revise: (id: string, owoIfa: number, items: EboItem[], dueDate: string | null, reason: string, ritualAt: string | null) =>
    rpc("ebo_revise", { p_id: id, p_owo_ifa: owoIfa, p_items: cleanItems(items), p_due_date: dueDate || null, p_reason: reason, p_ritual_at: ritualAt }),
  cancel: (id: string, reason: string) => rpc("ebo_cancel", { p_id: id, p_reason: reason }),
  start: (id: string) => rpc("ebo_mark_started", { p_id: id }),
  performed: (id: string, note: string) => rpc("ebo_mark_performed", { p_id: id, p_note: note || null }),
  reschedule: (id: string, ritualAt: string, reason: string) => rpc("ebo_reschedule", { p_id: id, p_ritual_at: ritualAt, p_reason: reason }),
  decline: (id: string, reason: string) => rpc("ebo_decline", { p_id: id, p_reason: reason || null }),
  requestTime: (id: string, note: string) => rpc("ebo_request_time", { p_id: id, p_note: note }),
  setAttendance: (id: string, attendance: "present" | "absent") => rpc("ebo_set_attendance", { p_id: id, p_attendance: attendance }),
  confirm: (id: string) => rpc("ebo_confirm", { p_id: id }),
  dispute: (id: string, reason: string) => rpc("ebo_dispute", { p_id: id, p_reason: reason }),
  selfStatus: (id: string, status: "in_progress" | "completed") => rpc("set_ebo_status", { p_id: id, p_status: status }),
  payWithWallet: (id: string, attendance: "present" | "absent") => rpc("pay_ebo_with_wallet", { p_id: id, p_attendance: attendance }),
  /** Card / bank transfer. The server prices it; the popup only collects the money. */
  payWithGateway: async (e: Ebo, attendance: "present" | "absent", gateway: PaymentGateway) => {
    const intent = await createPaymentIntent({ kind: "ebo", gateway, ebo_id: e.id, attendance });
    const popupSaidPaid = await openCheckout(intent, `Ebo: ${e.title}`);
    return verifyPayment(intent.reference, popupSaidPaid ? 6 : 1, popupSaidPaid ? 2000 : 0);
  },
  /** Make sure the live ritual session has its Meet link (safe to call more than once). */
  ensureRitualLink: async (sessionId: number | null | undefined) => {
    if (!sessionId) return;
    await apiFetch(`/v1/sessions/${sessionId}/meet-link`, { method: "POST", body: "{}" }).catch(() => {});
  },
  proofs: (id: string) => apiFetch<EboProof[]>(`/v1/ebo/${id}/proofs`),
  uploadProof: (id: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    return apiFetch<{ id: string; kind: string; status: string }>(`/v1/ebo/${id}/proofs`, { method: "POST", body: form });
  },
  adminSummary: () => rpc<Record<string, number>>("admin_ebo_summary", {}),
  adminResolve: (id: string, action: "release" | "refund_full" | "refund_held", note: string) =>
    rpc("admin_resolve_ebo", { p_id: id, p_action: action, p_note: note }),
};

function cleanItems(items: EboItem[]) {
  return items
    .filter((i) => i.name.trim())
    .map((i) => ({ name: i.name.trim(), quantity: Number(i.quantity) || 1, unit: i.unit || null, unit_price: Number(i.unit_price) || 0, catalog_item_id: i.catalog_item_id || null }));
}

export const sumItems = (items: EboItem[]) =>
  items.reduce((s, i) => s + Math.round((Number(i.quantity) || 0) * (Number(i.unit_price) || 0) * 100) / 100, 0);
