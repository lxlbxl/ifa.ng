import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { BookOpen, CalendarDays, Compass, HeartHandshake, HelpCircle, Loader2, Lock, Sparkles, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBabalawoAvailableNow } from '@/hooks/useBabalawoAvailableNow';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import ConsentFields, { type ConsentValue } from '@/components/session/ConsentFields';
import PaymentMethodSelector from '@/components/dashboard/user/PaymentMethodSelector';
import FeeDisclosure from '@/components/dashboard/user/FeeDisclosure';
import { fetchBabalawoAvailability, fetchBabalawoSchedule, getBookableSlots, type AvailabilitySlot, type BabalawoSchedule, type BookableSlot } from '@/utils/availabilityUtils';
import { handlePaymentAndBooking, type PaymentMethod } from '@/utils/multiGatewayPaymentHandler';
import { getUserWallet } from '@/utils/walletUtils';
import { parseBabalawoPrice } from '@/utils/priceUtils';
import { acquireSlotLock, completeSlotLock, releaseSlotLock } from '@/utils/slotLockUtils';
import { ensureMeetLink, recordSessionConsent } from '@/services/videoService';
import { pastelBlocks, pickBlock } from '@/design/tokens';
import { cn } from '@/lib/utils';
import { usePlatformRules } from '@/hooks/usePlatformRules';
import { ChoiceCard, StepFrame } from './StepFrame';
import { PhoneAuthFlow } from './PhoneAuthFlow';

/** The Babalawo being booked. `id` is their user id. */
export interface FlowBabalawo {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  hourly_rate?: number | string | null;
  current_status?: string | null;
  is_active?: boolean | null;
}

export type Topic = 'general' | 'spiritual' | 'personal' | 'unsure';
type Mode = 'schedule' | 'now';
type Step = 'topic' | 'mode' | 'day' | 'time' | 'auth' | 'pay';

export const TOPICS: { id: Topic; title: string; body: string; icon: React.ReactNode }[] = [
  { id: 'general', title: 'General Ifá consultation', body: 'Ask Ifá about your path and what lies ahead.', icon: <BookOpen /> },
  { id: 'spiritual', title: 'Spiritual guidance', body: 'Orí, Òrìṣà, ancestors, dreams and signs.', icon: <Sparkles /> },
  { id: 'personal', title: 'Personal matters', body: 'Love, family, work, health or money.', icon: <HeartHandshake /> },
  { id: 'unsure', title: 'Not sure yet', body: 'Talk it through. Your Babalawo will guide you.', icon: <HelpCircle /> },
];

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
/** A slot's time on the visitor's own clock, e.g. "2:30 pm". */
const timeLabel = (at: Date) => {
  const h = at.getHours(), m = at.getMinutes();
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

// ---------------------------------------------------------------------------
// Opening the flow from anywhere

interface Ctx { openConsult: (b: FlowBabalawo, opts?: { mode?: Mode }) => void }
const ConsultCtx = createContext<Ctx>({ openConsult: () => {} });
export const useConsultFlow = () => useContext(ConsultCtx);

export function ConsultFlowProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ babalawo: FlowBabalawo; mode?: Mode; key: number } | null>(null);
  const openConsult = useCallback((b: FlowBabalawo, opts?: { mode?: Mode }) =>
    setState({ babalawo: b, mode: opts?.mode, key: Date.now() }), []);
  const value = useMemo(() => ({ openConsult }), [openConsult]);
  return (
    <ConsultCtx.Provider value={value}>
      {children}
      {state && <ConsultFlow key={state.key} babalawo={state.babalawo} preferMode={state.mode} onClose={() => setState(null)} />}
    </ConsultCtx.Provider>
  );
}

// ---------------------------------------------------------------------------

export function ConsultFlow({ babalawo, preferMode, onClose }: { babalawo: FlowBabalawo; preferMode?: Mode; onClose: () => void }) {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<Step[]>(['topic']);
  const step = history[history.length - 1];
  const [topic, setTopic] = useState<Topic | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<BookableSlot | null>(null);
  const presence = useBabalawoAvailableNow(babalawo.id, babalawo, step === 'mode' || step === 'topic' || (step === 'pay' && mode === 'now'));
  const signedInAtStart = useRef(!!user);
  const name = babalawo.full_name || 'Babalawo';
  const short = name.replace(/^(Babalawo|Bàbá|Baba|Chief|Olúwo|Oluwo)\s+/i, '').split(' ')[0];

  // Lock the page behind the flow.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const push = (s: Step) => setHistory((h) => [...h, s]);
  const back = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const afterWhen = () => push(user ? 'pay' : 'auth');

  // Availability for Schedule (loaded as soon as the flow opens so the day step is instant).
  const [availability, setAvailability] = useState<AvailabilitySlot[] | null>(null);
  const [schedule, setSchedule] = useState<BabalawoSchedule | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      fetchBabalawoAvailability(babalawo.id),
      fetchBabalawoSchedule(babalawo.id).catch(() => null),
    ]).then(([a, s]) => { if (live) { setAvailability(a); setSchedule(s); } });
    return () => { live = false; };
  }, [babalawo.id]);

  // Slots are worked out on the Babalawo's calendar, then grouped by the visitor's own days.
  const days = useMemo(() => {
    if (!availability) return null;
    const horizon = Math.min(schedule?.settings?.max_advance_days ?? 30, 60);
    const byDay = new Map<string, { date: Date; slots: BookableSlot[] }>();
    for (const x of getBookableSlots(availability, schedule, horizon)) {
      const k = ymd(x.at);
      if (!byDay.has(k)) { if (byDay.size >= 14) break; byDay.set(k, { date: new Date(x.at.getFullYear(), x.at.getMonth(), x.at.getDate()), slots: [] }); }
      byDay.get(k)!.slots.push(x);
    }
    return [...byDay.values()];
  }, [availability, schedule]);
  const slots = useMemo(() => (day && days ? days.find((d) => ymd(d.date) === ymd(day))?.slots ?? [] : []), [day, days]);

  const top = (
    <div className="flex items-center gap-3">
      <span className="relative h-11 w-10 flex-none overflow-hidden rounded-[12px]" style={{ backgroundColor: pickBlock(name) }}>
        {babalawo.avatar_url && <img src={babalawo.avatar_url} alt="" className="h-full w-full object-cover" />}
      </span>
      <div className="min-w-0 text-sm leading-tight">
        <div className="truncate font-bold">{name}</div>
        <div className="truncate text-muted-foreground">
          {[topic && TOPICS.find((t) => t.id === topic)?.title,
            mode === 'now' ? 'Now' : slot ? `${format(slot.at, 'EEE d MMM')}, ${timeLabel(slot.at)}` : null].filter(Boolean).join(' · ') || 'Consultation'}
        </div>
      </div>
    </div>
  );

  const total = mode === 'now' ? 4 : 6;
  const idx = { topic: 0, mode: 1, day: 2, time: 3, auth: mode === 'now' ? 2 : 4, pay: total - 1 }[step];
  const progress = (idx + 1) / (total + 1);

  let body: React.ReactNode;

  if (step === 'topic') {
    body = (
      <StepFrame stepKey="topic" progress={progress} onClose={onClose} top={top}
        title="What would you like to consult about?" subtitle="Pick the closest one. You can say more in the session.">
        <div className="grid gap-3 sm:grid-cols-2">
          {TOPICS.map((t, i) => (
            <ChoiceCard key={t.id} testId={`topic-${t.id}`} icon={t.icon} title={t.title} body={t.body} color={pastelBlocks[i]}
              selected={topic === t.id}
              onClick={() => {
                setTopic(t.id);
                if (preferMode === 'now' && presence.availableNow) { setMode('now'); push(user ? 'pay' : 'auth'); }
                else push('mode');
              }} />
          ))}
        </div>
      </StepFrame>
    );
  } else if (step === 'mode') {
    const offline = !presence.availableNow;
    body = (
      <StepFrame stepKey="mode" progress={progress} onBack={back} onClose={onClose} top={top}
        title="When would you like to consult?">
        <div className="grid gap-3">
          <ChoiceCard testId="mode-now" icon={<Zap />} title="Consult now" color="#c7e86a" disabled={offline}
            badge={!offline ? <span className="inline-flex items-center gap-1.5 rounded-pill bg-ink px-2.5 py-1 text-xs font-bold text-cloth"><span className="h-2 w-2 animate-pulse rounded-full bg-leaf" />Online</span> : undefined}
            body={offline ? `${short} isn’t available right now. Schedule a time instead.` : `${short} is online. Start in a few minutes.`}
            onClick={() => { setMode('now'); push(user ? 'pay' : 'auth'); }} />
          <ChoiceCard testId="mode-schedule" icon={<CalendarDays />} title="Schedule" color="#f2c230"
            body={days && days.length === 0 ? `${short} has no open times at the moment.` : `Pick a day and time from ${short}’s calendar.`}
            disabled={days !== null && days.length === 0}
            onClick={() => { setMode('schedule'); push('day'); }} />
        </div>
      </StepFrame>
    );
  } else if (step === 'day') {
    body = (
      <StepFrame stepKey="day" progress={progress} onBack={back} onClose={onClose} top={top}
        title="Pick a day" subtitle={`Days when ${short} has free times.`}>
        {!days ? (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-panel bg-line" />)}</div>
        ) : days.length === 0 ? (
          <p className="rounded-panel bg-paper p-5">No open times in the coming weeks. Please check back soon or choose another Babalawo.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {days.map((d) => {
              const sel = day && ymd(d.date) === ymd(day);
              const isToday = ymd(d.date) === ymd(new Date());
              return (
                <button key={ymd(d.date)} type="button" data-testid={`day-${ymd(d.date)}`}
                  onClick={() => { setDay(d.date); setSlot(null); push('time'); }}
                  className={cn('flex h-24 flex-col items-center justify-center rounded-panel border-2 border-ink bg-paper transition-transform hover:-translate-y-0.5 hover:shadow-sticker',
                    sel && 'bg-sun')}>
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{isToday ? 'Today' : format(d.date, 'EEE')}</span>
                  <span className="font-display text-3xl font-extrabold leading-none">{format(d.date, 'd')}</span>
                  <span className="text-xs font-semibold">{format(d.date, 'MMM')} · {d.slots.length} free</span>
                </button>
              );
            })}
          </div>
        )}
      </StepFrame>
    );
  } else if (step === 'time' && day) {
    const groups = [
      ['Morning', slots.filter((x) => x.at.getHours() < 12)],
      ['Afternoon', slots.filter((x) => x.at.getHours() >= 12 && x.at.getHours() < 17)],
      ['Evening', slots.filter((x) => x.at.getHours() >= 17)],
    ] as const;
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' '); } catch { /* ignore */ }
    const babaTz = schedule?.settings?.timezone || 'Africa/Lagos';
    const sameZone = (() => { try { return new Date().toLocaleString('en-US', { timeZone: babaTz }) === new Date().toLocaleString('en-US'); } catch { return true; } })();
    const subtitle = tz ? `Times are in your time zone (${tz}).${sameZone ? '' : ` ${short} is in ${babaTz.replace(/_/g, ' ')}.`}` : undefined;
    body = (
      <StepFrame stepKey="time" progress={progress} onBack={back} onClose={onClose} top={top}
        title={`Pick a time on ${format(day, 'EEEE d MMMM')}`} subtitle={subtitle}>
        <div className="space-y-5">
          {groups.filter(([, ts]) => ts.length).map(([label, ts]) => (
            <div key={label}>
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
              <div className="grid grid-cols-3 gap-2.5">
                {ts.map((x) => (
                  <button key={x.date + x.time} type="button" data-testid={`time-${format(x.at, 'HH:mm')}`}
                    onClick={() => { setSlot(x); afterWhen(); }}
                    className={cn('h-14 rounded-pill border-2 border-ink bg-paper text-[17px] font-bold transition-transform hover:-translate-y-0.5 hover:shadow-sticker',
                      slot?.date === x.date && slot?.time === x.time && 'bg-sun')}>
                    {timeLabel(x.at)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </StepFrame>
    );
  } else if (step === 'auth') {
    body = (
      <PhoneAuthFlow
        top={top}
        onClose={onClose}
        onExit={back}
        progress={(p) => (idx + p) / (total + 1)}
        phoneTitle="What’s your phone number?"
        phoneSubtitle={`We’ll use it to sign you in and send your ${mode === 'now' ? 'session' : 'booking'} details. No password needed.`}
        onDone={() => push('pay')}
      />
    );
  } else {
    body = (
      <PayStep
        babalawo={babalawo} topic={topic ?? 'unsure'} mode={mode ?? 'schedule'} slot={slot}
        top={top} progress={progress}
        // Going back from payment skips the sign-in steps: the person is already signed in.
        onBack={() => setHistory((h) => h.filter((s) => s !== 'auth').slice(0, -1))}
        onClose={onClose}
        availableNow={presence.availableNow}
        onSlotTaken={() => setHistory((h) => [...h.filter((s) => s !== 'auth' && s !== 'pay')])}
        onDone={(sessionId) => {
          onClose();
          if (mode === 'now') navigate(`/session/${sessionId}`);
          else navigate('/dashboard');
        }}
        firstName={userProfile?.full_name?.split(' ')[0]}
        welcome={!signedInAtStart.current}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-ink/50 sm:grid sm:place-items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Consult ${name}`}>
      <div className="h-full w-full overflow-y-auto overscroll-contain bg-cloth sm:h-auto sm:max-h-[92vh] sm:min-h-[640px] sm:max-w-[600px] sm:rounded-[28px] sm:border-2 sm:border-ink sm:shadow-sticker-lg"
        data-testid="consult-flow">
        {body}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The existing pay wall (wallet, Paystack, Flutterwave), as the last step.

function PayStep({
  babalawo, topic, mode, slot, top, progress, onBack, onClose, onDone, onSlotTaken, availableNow, firstName, welcome,
}: {
  babalawo: FlowBabalawo; topic: Topic; mode: Mode; slot: BookableSlot | null; top: React.ReactNode; progress: number;
  onBack: () => void; onClose: () => void; onDone: (sessionId: string) => void; onSlotTaken: () => void;
  availableNow: boolean; firstName?: string; welcome: boolean;
}) {
  const { user, userProfile } = useAuth();
  const [method, setMethod] = useState<PaymentMethod>('paystack');
  const [wallet, setWallet] = useState(0);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState<ConsentValue>({ recording: false, ai: false });
  const [lock, setLock] = useState<string | null>(null);
  const amount = parseBabalawoPrice(babalawo);
  const name = babalawo.full_name || 'Babalawo';
  const rules = usePlatformRules();

  useEffect(() => {
    if (!user?.id) return;
    getUserWallet(user.id).then((w) => {
      const bal = w?.balance || 0;
      setWallet(bal);
      if (bal >= amount) setMethod('wallet');
    });
  }, [user?.id, amount]);

  // Hold the chosen slot for a few minutes while the person pays.
  useEffect(() => {
    if (mode !== 'schedule' || !slot || !user?.id) return;
    let held: string | null = null;
    let live = true;
    acquireSlotLock(babalawo.id, slot.date, slot.time, user.id).then((r) => {
      if (!live) { if (r.lockId) releaseSlotLock(r.lockId, user.id); return; }
      if (r.success && r.lockId) { held = r.lockId; setLock(r.lockId); }
      else if (r.lockedByOther) {
        toast({ title: 'That time was just taken', description: 'Please pick another time.', variant: 'destructive' });
        onSlotTaken();
      }
    });
    return () => { live = false; if (held) releaseSlotLock(held, user.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, slot, user?.id, babalawo.id]);

  async function pay() {
    if (!user) return;
    if (mode === 'now' && !availableNow) {
      toast({ title: `${name} just went offline`, description: 'Please schedule a time instead.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    // A booked time is sent on the Babalawo's own clock. Consult Now times are set by the server.
    const date = mode === 'now' ? ymd(new Date()) : slot!.date;
    const selectedTime = mode === 'now' ? new Date().toTimeString().slice(0, 5) : slot!.time;
    await handlePaymentAndBooking(
      { user, userProfile, babalawo, date, selectedTime, amount, paymentMethod: method, walletBalance: wallet, isInstant: mode === 'now' },
      async (sessionId) => {
        if (lock) await completeSlotLock(lock, user.id).catch(() => {});
        // Best effort: the session page asks again for anything that didn't go through.
        await supabase.rpc('set_session_topic' as never, { p_session_id: Number(sessionId), p_topic: topic } as never).then(() => {}, () => {});
        if (mode === 'schedule') {
          try {
            await recordSessionConsent(sessionId, consent.recording, consent.ai);
            await ensureMeetLink(sessionId);
          } catch (e) { console.warn('Consent / Meet link will be completed on the session page:', e); }
        }
        setBusy(false);
        toast({ title: mode === 'now' ? 'Paid. Joining your session…' : 'Booked!', description: mode === 'now' ? undefined : 'Your Google Meet link is on your dashboard.' });
        onDone(sessionId);
      },
      (message) => {
        setBusy(false);
        toast({ title: 'Payment not completed', description: message, variant: 'destructive' });
        if (/taken/i.test(message)) onSlotTaken();
      },
    );
  }

  const when = mode === 'now' ? 'Now, as soon as you pay' : slot ? `${format(slot.at, 'EEEE d MMMM')} at ${timeLabel(slot.at)}` : '';

  return (
    <StepFrame stepKey="pay" progress={progress} onBack={onBack} onClose={onClose} top={top}
      title={welcome && firstName ? `Almost there, ${firstName}.` : 'Confirm and pay'}
      subtitle={mode === 'now' ? 'You’ll join the call as soon as payment clears.' : 'Your Google Meet link arrives once payment clears.'}
      footer={
        <Button variant="sun" size="lg" className="w-full" onClick={pay} disabled={busy || (mode === 'schedule' && !slot)} data-testid="pay-button">
          {busy ? <><Loader2 className="animate-spin" /> Processing…</> : <><Lock /> Pay ₦{amount.toLocaleString()}{mode === 'now' ? ' and start' : ''}</>}
        </Button>
      }>
      <div className="space-y-5">
        <dl className="divide-y divide-line overflow-hidden rounded-panel border-2 border-ink bg-paper">
          {[
            ['Babalawo', name],
            ['About', TOPICS.find((t) => t.id === topic)?.title],
            ['When', when],
            ['Where', 'Google Meet, on your phone or laptop'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-muted-foreground">{k}</dt>
              <dd className="m-0 text-right font-semibold">{v}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 bg-cloth px-4 py-3">
            <dt className="font-bold">Total</dt>
            <dd className="m-0 font-display text-3xl font-extrabold tracking-[-0.02em]">₦{amount.toLocaleString()}</dd>
          </div>
        </dl>

        {lock && (
          <p className="m-0 flex items-center gap-2 rounded-field bg-leaf/50 px-4 py-3 text-sm">
            <Compass className="h-4 w-4" /> This time is held for you for 5 minutes while you pay.
          </p>
        )}

        <PaymentMethodSelector selectedMethod={method} onMethodChange={setMethod} walletBalance={wallet} amount={amount} />
        <FeeDisclosure amount={amount} paymentMethod={method} />
        {mode === 'schedule' && <ConsentFields value={consent} onChange={setConsent} role="client" />}
        <p className="m-0 text-sm text-muted-foreground" data-testid="pay-terms">
          By paying you agree to the <a className="underline" href="/terms" target="_blank" rel="noreferrer">Terms</a> and{' '}
          <a className="underline" href="/refunds" target="_blank" rel="noreferrer">Refund policy</a>.{' '}
          {mode === 'now' ? `If your Babalawo does not accept within ${rules.acceptMinutes} minutes, you are refunded in full.` : `Cancel at least ${rules.freeCancelHours} hours before the start for a full refund.`}
        </p>
      </div>
    </StepFrame>
  );
}
