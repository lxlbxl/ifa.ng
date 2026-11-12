import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Eyebrow, PageShell } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformRules, usePrivacyContacts } from '@/hooks/usePlatformRules';
import { cn } from '@/lib/utils';
import { privacyApi, REQUEST_TYPES, type RequestType } from '@/lib/privacy';

/**
 * Your data rights: a form anyone can use, with or without an account (for example a Babalawo
 * applicant, or someone who lost their phone). Signed-in people are pointed to Settings, where
 * most of this is instant.
 */
const PrivacyRequest = () => {
  const { user } = useAuth();
  const contacts = usePrivacyContacts();
  const rules = usePlatformRules();
  const [type, setType] = useState<RequestType>('access');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = user ? await privacyApi.request(type, details.trim()) : await privacyApi.publicRequest({ type, name, email, phone, details });
      setSent(r.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again, or email us.');
    } finally { setBusy(false); }
  };

  return (
    <PageShell>
      <article className="wrap max-w-[760px] py-16 md:py-20">
        <Eyebrow className="text-camwood">Nigeria Data Protection Act · GDPR · UK GDPR</Eyebrow>
        <h1 className="mt-3 font-display text-display-lg font-extrabold leading-[0.95] tracking-[-0.03em]">Your data rights</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink/90">
          You can ask to see, correct, move or delete the personal data we hold about you, to pause or object to how we use it,
          or to withdraw consent. We answer within {rules.dsarDays} days. If a request is complex we may need up to two months more,
          and we will tell you why. It's free.
        </p>
        {user ? (
          <p className="mt-4 rounded-field border-2 border-ink bg-sun/40 p-4 text-[15px]">
            You're signed in. In <Link className="font-semibold underline" to="/dashboard?tab=settings">Settings → Your privacy</Link> you
            can download your data, change your consents and delete your account straight away. You can also send a request here.
          </p>
        ) : (
          <p className="mt-4 text-[15px] text-muted-foreground">
            Have an account? <Link className="underline" to="/auth?next=/dashboard%3Ftab%3Dsettings">Sign in</Link> to do most of this yourself, instantly.
          </p>
        )}

        {sent ? (
          <div className="mt-10 rounded-panel border-2 border-ink bg-paper p-6" role="status">
            <CheckCircle2 className="h-8 w-8 text-camwood" />
            <h2 className="mt-3 font-display text-2xl font-extrabold">Request received (number {sent})</h2>
            <p className="mt-2 leading-relaxed">
              {user
                ? 'You can follow it in Settings → Your privacy.'
                : 'Before we release or delete anything, we will contact you to confirm it is really you, usually with a code sent to the phone number on the account.'}
              {' '}Questions: <a className="underline" href={`mailto:${contacts.dpoEmail}`}>{contacts.dpoEmail}</a>.
            </p>
          </div>
        ) : (
          <form className="mt-10 space-y-6" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <fieldset>
              <legend className="mb-3 font-display text-xl font-extrabold">What would you like?</legend>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {REQUEST_TYPES.map((r) => (
                  <button key={r.value} type="button" onClick={() => setType(r.value)} aria-pressed={type === r.value}
                    className={cn('rounded-field border-2 p-3.5 text-left transition-colors',
                      type === r.value ? 'border-ink bg-ink text-cloth' : 'border-line bg-paper hover:border-ink/50')}>
                    <span className="block font-bold">{r.label}</span>
                    {r.help && <span className={cn('block text-sm', type === r.value ? 'text-cloth/80' : 'text-muted-foreground')}>{r.help}</span>}
                  </button>
                ))}
              </div>
            </fieldset>

            {!user && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="dr-name">Your full name</Label>
                  <Input id="dr-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
                </div>
                <div>
                  <Label htmlFor="dr-phone">Phone number on your account</Label>
                  <Input id="dr-phone" type="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} placeholder="+234…" autoComplete="tel" />
                </div>
                <div>
                  <Label htmlFor="dr-email">Email for our reply</Label>
                  <Input id="dr-email" type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <p className="m-0 text-sm text-muted-foreground sm:col-span-2">Give at least one, so we can reach you and check it's you.</p>
              </div>
            )}
            <div>
              <Label htmlFor="dr-details">Details</Label>
              <Textarea id="dr-details" rows={4} maxLength={4000} value={details} onChange={(e) => setDetails(e.target.value)}
                placeholder="What should we look at? For a correction, say what is wrong and what it should be." />
            </div>
            {error && <p role="alert" className="rounded-field bg-camwood/10 px-3 py-2 text-sm font-semibold text-camwood">{error}</p>}
            <Button type="submit" variant="sun" size="lg" disabled={busy || (!user && (name.trim().length < 2 || (!email.trim() && !phone.trim())))}>
              {busy ? <Loader2 className="animate-spin" /> : 'Send request'}
            </Button>
            <p className="text-sm text-muted-foreground">
              We use what you write here only to answer your request, and keep it for {rules.retention.requestsYears} years as a record
              that we did. You can also write to {contacts.dpoName ? `${contacts.dpoName}, ` : ''}our Data Protection Officer, at{' '}
              <a className="underline" href={`mailto:${contacts.dpoEmail}`}>{contacts.dpoEmail}</a>. If you're unhappy with our answer you can
              complain to the Nigeria Data Protection Commission, or to the data protection authority where you live (see the{' '}
              <Link className="underline" to="/privacy#complaints">Privacy policy</Link>).
            </p>
          </form>
        )}
      </article>
    </PageShell>
  );
};

export default PrivacyRequest;
