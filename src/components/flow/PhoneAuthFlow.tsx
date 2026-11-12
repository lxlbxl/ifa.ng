import { useEffect, useRef, useState } from 'react';
import { Loader2, MessageCircle, MessageSquare } from 'lucide-react';
import type { CountryCode } from 'libphonenumber-js/min';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { apiAuth, type PhoneStartResult } from '@/integrations/api/auth';
import { ApiError } from '@/integrations/api/config';
import { detectCountry, formatNational, prettyPhone, toE164 } from '@/lib/countries';
import { cn } from '@/lib/utils';
import { CountryPicker } from './CountryPicker';
import { StepFrame } from './StepFrame';
import { ConsentForm } from '@/components/privacy/ConsentForm';
import { blockingConsents, privacyApi, type ConsentPurpose } from '@/lib/privacy';

export type AuthStep = 'phone' | 'otp' | 'pin' | 'newPin' | 'confirmPin' | 'name' | 'consent';

/** Rough share of the auth part each step represents, for the progress bar. */
const ORDER: AuthStep[] = ['phone', 'otp', 'pin', 'newPin', 'confirmPin', 'name', 'consent'];

const errMsg = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong. Please try again.');
const errCode = (e: unknown) => (e instanceof ApiError ? (e.body as { code?: string } | null)?.code : undefined);

interface Props {
  /** Called when the person is signed in, has a PIN, and (if asked) a first name. */
  onDone: (r: { isNew: boolean }) => void;
  /** Back from the first (phone) step. */
  onExit?: () => void;
  onClose?: () => void;
  /** Maps this flow's own progress (0..1) onto the parent's bar. */
  progress?: (p: number) => number;
  top?: React.ReactNode;
  /** Ask a new person for their first name (bookings need it). */
  askName?: boolean;
  /** Wording for the phone question. */
  phoneTitle?: React.ReactNode;
  phoneSubtitle?: React.ReactNode;
}

/**
 * Phone number -> PIN (returning) or code -> new PIN (new / forgot) -> first name.
 * Each screen asks one thing; codes and PINs submit themselves when complete.
 */
export function PhoneAuthFlow({ onDone, onExit, onClose, progress = (p) => p, top, askName = true, phoneTitle, phoneSubtitle }: Props) {
  const [step, setStep] = useState<AuthStep>('phone');
  const [country, setCountry] = useState<CountryCode>('NG');
  const [countryTouched, setCountryTouched] = useState(false);
  const [national, setNational] = useState('');
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [phone, setPhone] = useState('');
  const [start, setStart] = useState<PhoneStartResult | null>(null);
  const [ticket, setTicket] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [needsName, setNeedsName] = useState(false);
  const [value, setValue] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [name, setName] = useState('');
  const [missing, setMissing] = useState<ConsentPurpose[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  // Remounts the code/PIN boxes after a failed try so they clear and take focus again.
  const [attempt, setAttempt] = useState(0);
  const setError = (e: string | null) => { setErrorState(e); if (e) setAttempt((n) => n + 1); };
  const [resendIn, setResendIn] = useState(0);
  const phoneInput = useRef<HTMLInputElement>(null);

  // Country from the IP (or the device) until the person picks one themselves.
  useEffect(() => {
    let live = true;
    detectCountry().then((c) => { if (live && !countryTouched) setCountry(c); });
    return () => { live = false; };
  }, [countryTouched]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const go = (s: AuthStep) => { setError(null); setValue(''); setStep(s); };
  const e164 = toE164(national, country);
  const finish = (newPerson: boolean, nameNeeded: boolean) => {
    if (askName && nameNeeded) { setIsNew(newPerson); go('name'); }
    else return afterName(newPerson);
  };
  // Age, terms, privacy notice and special-category consent, asked once (and again if the notice changes).
  async function afterName(newPerson: boolean) {
    try {
      const m = blockingConsents(await privacyApi.status());
      if (m.length) { setMissing(m); setIsNew(newPerson); go('consent'); return; }
    } catch { /* the dashboard asks again if this check could not run */ }
    onDone({ isNew: newPerson });
  }

  async function submitPhone(forgotPin = false) {
    const p = forgotPin ? phone : e164;
    if (!p) { setError('That number doesn’t look right for this country.'); return; }
    setBusy(true); setError(null);
    try {
      const r = await apiAuth.phoneStart(p, { channel, forgotPin });
      setPhone(r.phone);
      setStart(r);
      if (r.next === 'pin') go('pin');
      else { setResendIn(r.resend_in); go('otp'); }
    } catch (e) {
      setError(errMsg(e));
    } finally { setBusy(false); }
  }

  async function submitOtp(code: string) {
    setBusy(true); setError(null);
    try {
      const r = await apiAuth.phoneVerifyOtp(phone, code);
      // Admins with a PIN are signed in by the code alone.
      if (r.skip_pin) { await finish(false, r.needs_name); return; }
      setTicket(r.pin_ticket ?? '');
      setIsNew(r.is_new);
      setNeedsName(r.needs_name);
      go('newPin');
    } catch (e) {
      setError(errMsg(e)); setValue('');
    } finally { setBusy(false); }
  }

  async function submitPin(pin: string) {
    setBusy(true); setError(null);
    try {
      const r = await apiAuth.phoneSignInPin(phone, pin);
      await finish(false, r.needs_name);
    } catch (e) {
      if (errCode(e) === 'NO_PIN') { await submitPhone(true); return; }
      if (errCode(e) === 'CODE_REQUIRED') { await submitPhone(false); return; }
      setError(errMsg(e)); setValue('');
    } finally { setBusy(false); }
  }

  async function confirmPin(pin: string) {
    if (pin !== firstPin) { setError('Those PINs don’t match. Choose your PIN again.'); setFirstPin(''); setStep('newPin'); setValue(''); return; }
    setBusy(true); setError(null);
    try {
      await apiAuth.phoneSetPin(pin, ticket);
      await finish(isNew, needsName);
    } catch (e) {
      const code = errCode(e);
      if (code === 'WEAK_PIN' || code === 'INVALID_PIN') { setFirstPin(''); setStep('newPin'); setValue(''); setError(errMsg(e)); }
      else { setError(errMsg(e)); setValue(''); }
    } finally { setBusy(false); }
  }

  async function submitName() {
    const n = name.trim();
    if (n.length < 2) { setError('Please type your first name.'); return; }
    setBusy(true); setError(null);
    try {
      await apiAuth.updateName(n);
      await afterName(isNew);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  const back = () => {
    if (step === 'phone') return onExit?.();
    if (step === 'confirmPin') return go('newPin');
    if (step === 'otp' || step === 'pin') return go('phone');
    // Already signed in from here on; going back to the number would be confusing.
  };
  const canBack = step === 'phone' ? !!onExit : step === 'otp' || step === 'pin' || step === 'confirmPin';
  const p = progress((ORDER.indexOf(step) + 1) / (ORDER.length + 1));

  const Error = () => error ? <p role="alert" className="mt-4 rounded-field bg-coral/15 px-4 py-3 font-semibold text-coral-700">{error}</p> : null;

  const digits = (len: number, onComplete: (v: string) => void, masked = false, testId?: string) => (
    <InputOTP
      key={`${step}-${attempt}`}
      maxLength={len}
      value={value}
      onChange={(v) => { setValue(v.replace(/\D/g, '')); if (error) setError(null); }}
      onComplete={(v: string) => onComplete(v)}
      disabled={busy}
      autoFocus
      inputMode="numeric"
      pattern="^[0-9]*$"
      autoComplete={len === 6 ? 'one-time-code' : 'off'}
      data-testid={testId}
      containerClassName="justify-center sm:justify-start"
    >
      <InputOTPGroup className="gap-2.5">
        {Array.from({ length: len }, (_, i) => (
          <InputOTPSlot
            key={i}
            index={i}
            className={cn(
              'h-16 w-12 rounded-field border-2 border-ink bg-paper font-display text-3xl font-extrabold first:rounded-l-field last:rounded-r-field sm:w-14',
              masked && '[-webkit-text-security:disc]',
            )}
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );

  if (step === 'phone') {
    return (
      <StepFrame stepKey="phone" progress={p} onBack={canBack ? back : undefined} onClose={onClose} top={top}
        title={phoneTitle ?? 'What’s your phone number?'}
        subtitle={phoneSubtitle ?? 'We use it to sign you in and to send your session link. No password needed.'}
        footer={
          <Button variant="sun" size="lg" className="w-full" disabled={!e164 || busy} onClick={() => submitPhone()} data-testid="phone-continue">
            {busy ? <Loader2 className="animate-spin" /> : 'Continue'}
          </Button>
        }>
        <form onSubmit={(e) => { e.preventDefault(); if (e164) submitPhone(); }} className="space-y-5">
          <div className="flex gap-2.5">
            <CountryPicker value={country} onChange={(c) => { setCountryTouched(true); setCountry(c); phoneInput.current?.focus(); }} />
            <input
              ref={phoneInput}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              autoFocus
              value={formatNational(national, country)}
              onChange={(e) => { setNational(e.target.value.replace(/[^\d]/g, '').slice(0, 15)); setError(null); }}
              placeholder={country === 'NG' ? '803 123 4567' : 'Phone number'}
              className="h-16 min-w-0 flex-1 rounded-field border-2 border-ink bg-paper px-4 font-display text-2xl font-bold tracking-[0.01em] outline-none placeholder:font-sans placeholder:text-lg placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
              aria-label="Phone number"
              data-testid="phone-input"
            />
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">If we need to send you a code, send it by</legend>
            <div className="grid grid-cols-2 gap-2.5">
              {([['sms', 'SMS', MessageSquare], ['whatsapp', 'WhatsApp', MessageCircle]] as const).map(([v, label, Icon]) => (
                <button key={v} type="button" onClick={() => setChannel(v)} aria-pressed={channel === v}
                  className={cn('flex h-14 items-center justify-center gap-2 rounded-pill border-2 text-base font-bold transition-colors',
                    channel === v ? 'border-ink bg-ink text-cloth' : 'border-line bg-paper text-ink hover:border-ink/50')}>
                  <Icon className="h-5 w-5" /> {label}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="sr-only">Continue</button>
        </form>
        <Error />
      </StepFrame>
    );
  }

  if (step === 'otp' && start?.next === 'otp') {
    return (
      <StepFrame stepKey="otp" progress={p} onBack={back} onClose={onClose} top={top}
        title="Enter the 6-digit code"
        subtitle={<>We sent it by {start.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to <b className="text-ink">{prettyPhone(phone)}</b>.</>}>
        {digits(6, submitOtp, false, 'otp-input')}
        {start.dev_code && (
          <p className="mt-5 rounded-field border-2 border-dashed border-ink/40 bg-sun/30 px-4 py-3 text-sm">
            Test mode: no SMS was sent. Your code is <b className="font-display text-lg tracking-[0.2em]">{start.dev_code}</b>
          </p>
        )}
        <Error />
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] font-semibold">
          {busy && <Loader2 className="h-5 w-5 animate-spin" aria-label="Checking" />}
          <button type="button" disabled={resendIn > 0 || busy} onClick={() => submitPhone(start.purpose === 'reset_pin')}
            className="underline underline-offset-4 disabled:no-underline disabled:opacity-50">
            {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
          </button>
          <button type="button" onClick={() => go('phone')} className="underline underline-offset-4">Change number</button>
        </div>
      </StepFrame>
    );
  }

  if (step === 'pin') {
    const who = start?.next === 'pin' && start.name ? start.name.split(' ')[0] : null;
    return (
      <StepFrame stepKey="pin" progress={p} onBack={back} onClose={onClose} top={top}
        title={who ? `Welcome back, ${who}` : 'Enter your 4-digit PIN'}
        subtitle={<>{who ? 'Enter your 4-digit PIN for ' : 'Signing in as '}<b className="text-ink">{prettyPhone(phone)}</b>.</>}>
        {digits(4, submitPin, true, 'pin-input')}
        <Error />
        <div className="mt-6 flex items-center gap-5 text-[15px] font-semibold">
          {busy && <Loader2 className="h-5 w-5 animate-spin" aria-label="Checking" />}
          <button type="button" disabled={busy} onClick={() => submitPhone(true)} className="underline underline-offset-4">
            Forgot PIN? Get a code
          </button>
        </div>
      </StepFrame>
    );
  }

  if (step === 'newPin' || step === 'confirmPin') {
    const confirming = step === 'confirmPin';
    return (
      <StepFrame stepKey={step} progress={p} onBack={confirming ? back : undefined} onClose={onClose} top={top}
        title={confirming ? 'Type your PIN again' : 'Choose a 4-digit PIN'}
        subtitle={confirming ? 'Just to be sure.' : 'You’ll use it with your phone number to sign in next time. Avoid 1234 or your birth year.'}>
        {digits(4, (v) => {
          if (!confirming) { setFirstPin(v); setValue(''); setError(null); setStep('confirmPin'); }
          else confirmPin(v);
        }, true, confirming ? 'confirm-pin-input' : 'new-pin-input')}
        {busy && <Loader2 className="mt-5 h-5 w-5 animate-spin" aria-label="Saving" />}
        <Error />
      </StepFrame>
    );
  }

  if (step === 'consent') {
    return (
      <StepFrame stepKey="consent" progress={p} onClose={onClose} top={top}
        title="Before you continue"
        subtitle="Consultations are personal. Please confirm a few things. We only ask once.">
        <ConsentForm missing={missing} source={isNew ? 'signup' : 'app'} onDone={() => onDone({ isNew })} />
      </StepFrame>
    );
  }

  // name
  return (
    <StepFrame stepKey="name" progress={p} onClose={onClose} top={top}
      title="What’s your first name?"
      subtitle="So your Babalawo knows how to greet you."
      footer={
        <Button variant="sun" size="lg" className="w-full" disabled={name.trim().length < 2 || busy} onClick={submitName} data-testid="name-continue">
          {busy ? <Loader2 className="animate-spin" /> : 'Continue'}
        </Button>
      }>
      <form onSubmit={(e) => { e.preventDefault(); submitName(); }}>
        <input
          autoFocus
          value={name}
          onChange={(e) => { setName(e.target.value.slice(0, 60)); setError(null); }}
          autoComplete="given-name"
          autoCapitalize="words"
          placeholder="e.g. Adébáyọ̀"
          className="h-16 w-full rounded-field border-2 border-ink bg-paper px-4 font-display text-2xl font-bold outline-none placeholder:font-sans placeholder:text-lg placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
          aria-label="First name"
          data-testid="name-input"
        />
      </form>
      <Error />
    </StepFrame>
  );
}
