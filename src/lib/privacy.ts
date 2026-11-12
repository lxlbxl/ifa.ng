import { supabase } from '@/integrations/supabase/client';

/**
 * Data protection (NDPA 2023, GDPR): consents, privacy requests, export and withdrawal.
 * Everything here calls database functions in db/migrations/20261117000000_data_protection.sql.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type ConsentPurpose = 'age_confirmed' | 'terms' | 'privacy_notice' | 'special_category' | 'marketing' | 'whatsapp' | 'sms' | 'error_reports';
export const REQUIRED_CONSENTS: ConsentPurpose[] = ['age_confirmed', 'terms', 'privacy_notice', 'special_category'];

export type RequestType = 'access' | 'portability' | 'rectification' | 'erasure' | 'restriction' | 'objection'
  | 'withdraw_consent' | 'automated_decision' | 'complaint' | 'other';
export type RequestStatus = 'received' | 'verifying' | 'in_progress' | 'extended' | 'completed' | 'rejected';

export const REQUEST_TYPES: { value: RequestType; label: string; help: string }[] = [
  { value: 'access', label: 'See what you hold about me', help: 'A copy of your personal data and how we use it.' },
  { value: 'rectification', label: 'Correct my details', help: 'Something is wrong or out of date, such as your phone number.' },
  { value: 'erasure', label: 'Delete my data', help: 'If you can sign in, you can also do this yourself in Settings.' },
  { value: 'restriction', label: 'Pause using my data', help: 'While a correction or objection is checked.' },
  { value: 'objection', label: 'Object to how you use my data', help: 'For example to fraud checks or service messages.' },
  { value: 'portability', label: 'Move my data elsewhere', help: 'Your data in a machine-readable file.' },
  { value: 'withdraw_consent', label: 'Withdraw my consent', help: 'For recordings, AI notes, or anything else you agreed to.' },
  { value: 'automated_decision', label: 'Ask a person to review', help: 'If you think a computer made a decision about you.' },
  { value: 'complaint', label: 'Make a privacy complaint', help: 'Tell our Data Protection Officer what went wrong.' },
  { value: 'other', label: 'Something else', help: '' },
];
export const requestLabel = (t: string) => REQUEST_TYPES.find((r) => r.value === t)?.label ?? t;
export const STATUS_LABEL: Record<RequestStatus, string> = {
  received: 'Received', verifying: 'Checking it is you', in_progress: 'In progress', extended: 'Extended',
  completed: 'Done', rejected: 'Declined',
};

export interface PrivacyStatus {
  notice_version: string;
  missing: ConsentPurpose[];
  consents: Partial<Record<ConsentPurpose, { granted: boolean; at: string; version: string }>>;
  recording_consents: number;
  requests: { id: number; type: RequestType; status: RequestStatus; received_at: string; due_at: string; completed_at: string | null; response: string | null }[];
}

/**
 * Consents that must be given before using the account at all. Someone who withdrew consent for
 * consultation content can still sign in (to download or delete their data); booking asks again.
 */
export const blockingConsents = (s?: Pick<PrivacyStatus, 'missing' | 'consents'> | null) =>
  (s?.missing ?? []).filter((m) => !(m === 'special_category' && s?.consents?.special_category?.granted === false));

const unwrap = <T,>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) throw new Error(error.message);
  return data;
};

export const privacyApi = {
  status: async () => unwrap<PrivacyStatus>(await db.rpc('my_privacy_status')),
  record: async (items: Partial<Record<ConsentPurpose, boolean>>, source: 'signup' | 'app' | 'settings' | 'banner' = 'app') =>
    unwrap<PrivacyStatus>(await db.rpc('record_consents', { p_items: items, p_source: source, p_user_agent: navigator.userAgent.slice(0, 300) })),
  request: async (type: RequestType, details?: string) =>
    unwrap<{ id: number; due_at: string }>(await db.rpc('submit_data_request', { p_type: type, p_details: details ?? null })),
  publicRequest: async (r: { type: RequestType; name: string; email?: string; phone?: string; details?: string }) =>
    unwrap<{ id: number }>(await db.rpc('submit_public_data_request', { p_type: r.type, p_name: r.name, p_email: r.email || null, p_phone: r.phone || null, p_details: r.details || null })),
  exportMine: async () => unwrap<unknown>(await db.rpc('export_my_data')),
  withdrawRecordings: async (sessionId?: number) =>
    unwrap<{ sessions: number; files: number }>(await db.rpc('withdraw_recording_consent', { p_session_id: sessionId ?? null })),
};

/** Saves JSON as a file the person can keep. */
export function downloadJson(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------- this browser's choices
// IFA.ng sets no advertising or analytics cookies. The only optional thing is crash reports
// (no cookies, no account details: the error, the page and the browser), sent under our
// legitimate interest in keeping the app working. Visitors can turn them off; the choice
// lives in this browser only.
const CHOICE_KEY = 'ifa.privacy-choices.v1';
export interface BrowserChoices { errorReports: boolean; decidedAt: string }

export function readBrowserChoices(): BrowserChoices | null {
  try {
    const raw = localStorage.getItem(CHOICE_KEY);
    return raw ? (JSON.parse(raw) as BrowserChoices) : null;
  } catch { return null; }
}
export function saveBrowserChoices(c: { errorReports: boolean }) {
  try { localStorage.setItem(CHOICE_KEY, JSON.stringify({ ...c, decidedAt: new Date().toISOString() })); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent('ifa:privacy-choices'));
}
/** Crash reports unless the visitor turned them off. */
export const errorReportsAllowed = () => readBrowserChoices()?.errorReports !== false;
