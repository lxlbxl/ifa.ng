import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { privacyApi, type ConsentPurpose, type PrivacyStatus } from '@/lib/privacy';

/** One tick box, big enough to tap. Required ones are marked; nothing is ticked for you. */
function Tick({ checked, onChange, children, required, testId }: {
  checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; required?: boolean; testId?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-field border-2 bg-paper p-3.5 transition-colors',
      checked ? 'border-ink' : 'border-line hover:border-ink/50')}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      <span aria-hidden className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border-2',
        checked ? 'border-ink bg-ink text-cloth' : 'border-ink/40 bg-paper')}>
        {checked && <Check className="h-4 w-4" strokeWidth={3} />}
      </span>
      <span className="text-[15px] leading-snug">
        {children}
        {required && <span className="ml-1 text-xs font-bold uppercase tracking-[0.08em] text-camwood">Required</span>}
      </span>
    </label>
  );
}

/**
 * What a person agrees to before using IFA.ng (NDPA s.25–26 and s.30, GDPR Art. 6, 7, 8 and 9):
 * age, terms, the privacy notice, and explicit consent for consultation content, which can reveal
 * religious beliefs and health. Marketing is optional and off unless ticked. Each choice is logged
 * with the notice version, and can be changed in Settings.
 */
export function ConsentForm({ missing, onDone, source = 'app', submitLabel = 'Continue' }: {
  missing?: ConsentPurpose[];
  onDone: (s: PrivacyStatus) => void;
  source?: 'signup' | 'app';
  submitLabel?: string;
}) {
  const ask = (p: ConsentPurpose) => !missing || missing.includes(p);
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [special, setSpecial] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showTerms = ask('terms') || ask('privacy_notice');
  const ready = (!ask('age_confirmed') || age) && (!showTerms || terms) && (!ask('special_category') || special);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const items: Partial<Record<ConsentPurpose, boolean>> = {};
      if (ask('age_confirmed')) items.age_confirmed = age;
      if (showTerms) { items.terms = terms; items.privacy_notice = terms; }
      if (ask('special_category')) items.special_category = special;
      if (!missing) items.marketing = marketing;
      onDone(await privacyApi.record(items, source));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      {ask('age_confirmed') && (
        <Tick checked={age} onChange={setAge} required testId="consent-age">I am 18 or older.</Tick>
      )}
      {showTerms && (
        <Tick checked={terms} onChange={setTerms} required testId="consent-terms">
          I agree to the <Link to="/terms" target="_blank" className="font-semibold underline">Terms of use</Link> and have read the{' '}
          <Link to="/privacy" target="_blank" className="font-semibold underline">Privacy policy</Link>.
        </Tick>
      )}
      {ask('special_category') && (
        <Tick checked={special} onChange={setSpecial} required testId="consent-special">
          I agree that IFA.ng and my Babalawo may use what I share in consultations to give me guidance. This can reveal my
          spiritual or religious beliefs and my health, so it is protected more strictly. I can withdraw this at any time.
        </Tick>
      )}
      {!missing && (
        <Tick checked={marketing} onChange={setMarketing}>
          Send me occasional news and offers from IFA.ng. <span className="text-muted-foreground">(Optional. You can stop them any time.)</span>
        </Tick>
      )}
      <p className="text-sm text-muted-foreground">
        Recording a consultation is a separate choice, made before each session.
      </p>
      {error && <p role="alert" className="rounded-field bg-camwood/10 px-3 py-2 text-sm font-semibold text-camwood">{error}</p>}
      <Button variant="sun" size="lg" className="w-full" disabled={!ready || busy} onClick={submit} data-testid="consent-continue">
        {busy ? <Loader2 className="animate-spin" /> : submitLabel}
      </Button>
    </div>
  );
}
