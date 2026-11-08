import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Globe2, Laptop, Loader2, MapPin, Video, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Eyebrow, Logo, TickDot } from '@/components/brand';
import { ChoiceCard, StepFrame } from '@/components/flow/StepFrame';
import { PhoneAuthFlow } from '@/components/flow/PhoneAuthFlow';
import { countryByCode, detectCountry } from '@/lib/countries';
import { pastelBlocks } from '@/design/tokens';
import { cn } from '@/lib/utils';

const SPECIALTIES = ['Odù readings', 'Ẹbọ and rituals', 'Orí', 'Òrìṣà guidance', 'Initiation (Ìtẹ̀fá)', 'Herbal medicine (Ewé)',
  'Dreams and signs', 'Ancestors (Égún)', 'Relationships', 'Work and money', 'Health', 'Children and fertility'];
const LANGUAGES = ['Yorùbá', 'English', 'Pidgin', 'Portuguese', 'Spanish', 'French', 'Fon'];
const YEARS = [{ label: 'Under 5 years', v: 3 }, { label: '5 to 10 years', v: 7 }, { label: '10 to 20 years', v: 15 }, { label: 'More than 20 years', v: 25 }];
const ONLINE = [
  { v: 'yes', title: 'Yes, often', body: 'I already consult by video or phone.', icon: <Video /> },
  { v: 'sometimes', title: 'Sometimes', body: 'I have done a few.', icon: <Laptop /> },
  { v: 'no', title: 'Not yet', body: 'That’s fine. We’ll show you how.', icon: <Globe2 /> },
] as const;

type Step = 'intro' | 'auth' | 'name' | 'place' | 'years' | 'ile' | 'specialties' | 'languages' | 'online' | 'bio' | 'contact' | 'status';
const FLOW: Step[] = ['intro', 'auth', 'name', 'place', 'years', 'ile', 'specialties', 'languages', 'online', 'bio', 'contact'];

interface Application { status: 'waitlisted' | 'approved' | 'rejected'; review_notes: string | null; created_at: string; full_name: string }

const field = 'h-16 w-full rounded-field border-2 border-ink bg-paper px-4 text-xl font-semibold outline-none placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring';

/** Babalawo onboarding: one question per screen, ending on the waitlist for an admin to review. */
const BabalawoApply = () => {
  const { user, loading, hasRole } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<Step[]>(['intro']);
  const step = history[history.length - 1];
  const push = (s: Step) => setHistory((h) => [...h, s]);
  const back = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const next = () => {
    const i = FLOW.indexOf(step);
    let n = FLOW[i + 1];
    if (n === 'auth' && user) n = 'name';
    push(n);
  };

  const [existing, setExisting] = useState<Application | null | undefined>(undefined);
  const [form, setForm] = useState({
    full_name: '', country: '', city: '', years: 0, ile: '', specialties: [] as string[], languages: ['Yorùbá'] as string[],
    online: '', bio: '', email: '', referral: '',
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { detectCountry().then((c) => setForm((f) => (f.country ? f : { ...f, country: countryByCode(c)?.name ?? '' }))); }, []);

  useEffect(() => {
    if (!user) { setExisting(null); return; }
    supabase.from('babalawo_applications' as never).select('status, review_notes, created_at, full_name').maybeSingle()
      .then(({ data }) => setExisting((data as Application | null) ?? null), () => setExisting(null));
    if (user.user_metadata.full_name) setForm((f) => (f.full_name ? f : { ...f, full_name: user.user_metadata.full_name! }));
  }, [user]);

  useEffect(() => {
    if (existing && step !== 'status' && step !== 'contact') setHistory(['status']);
  }, [existing, step]);

  async function submit() {
    setBusy(true); setError(null);
    const { error } = await supabase.rpc('submit_babalawo_application' as never, {
      p_full_name: form.full_name, p_email: form.email || null, p_country: form.country || null, p_city: form.city || null,
      p_ile_name: form.ile || null, p_years_practising: form.years || null, p_specialties: form.specialties,
      p_languages: form.languages, p_consults_online: form.online || null, p_bio: form.bio || null, p_referral: form.referral || null,
    } as never);
    setBusy(false);
    if (error) { setError(error.message); return; }
    setExisting({ status: 'waitlisted', review_notes: null, created_at: new Date().toISOString(), full_name: form.full_name });
    setHistory(['status']);
  }

  if (!loading && user && hasRole('babalawo')) {
    return (
      <Shell>
        <StepFrame stepKey="already" progress={1} title="You’re already a Babalawo on IFA.ng."
          footer={<Button variant="sun" size="lg" className="w-full" onClick={() => navigate('/dashboard')}>Go to your dashboard</Button>}>
          <p className="text-lg">Set your hours and fee from your dashboard.</p>
        </StepFrame>
      </Shell>
    );
  }

  const i = Math.max(0, FLOW.indexOf(step));
  const progress = (i + 1) / (FLOW.length + 1);
  const Err = () => (error ? <p role="alert" className="mt-4 rounded-field bg-coral/15 px-4 py-3 font-semibold text-coral-700">{error}</p> : null);
  const cont = (disabled = false, label = 'Continue', onClick: () => void = next) => (
    <Button variant="sun" size="lg" className="w-full" disabled={disabled || busy} onClick={onClick}>
      {busy ? <Loader2 className="animate-spin" /> : label}
    </Button>
  );
  const chips = (all: string[], k: 'specialties' | 'languages') => (
    <div className="flex flex-wrap gap-2.5">
      {all.map((s) => {
        const on = form[k].includes(s);
        return (
          <button key={s} type="button" aria-pressed={on}
            onClick={() => set(k, on ? form[k].filter((x) => x !== s) : [...form[k], s])}
            className={cn('min-h-12 rounded-pill border-2 px-4 py-2 text-[16px] font-bold transition-colors',
              on ? 'border-ink bg-ink text-cloth' : 'border-line bg-paper hover:border-ink/50')}>
            {s}
          </button>
        );
      })}
    </div>
  );

  let body: React.ReactNode;
  switch (step) {
    case 'intro':
      body = (
        <StepFrame stepKey="intro" progress={progress} onClose={() => navigate('/')}
          title={<>Consult the world from your <span className="text-camwood">ilé.</span></>}
          subtitle="Apply to offer Ifá consultations on IFA.ng. It takes about three minutes."
          footer={cont(false, 'Start my application')}>
          <ul className="grid list-none gap-3 p-0 text-[17px]">
            {['Set your own fee and hours', 'Sessions on Google Meet, from your phone', 'Notes drafted for you to approve', 'Paid to your bank account'].map((t, n) => (
              <li key={t} className="flex items-center gap-3"><TickDot>{n + 1}</TickDot>{t}</li>
            ))}
          </ul>
          <p className="mt-6 rounded-panel bg-paper p-4 text-[15px] text-muted-foreground">
            We review every application by hand and speak with you before you go live. You’ll be on the waitlist until then.
          </p>
        </StepFrame>
      );
      break;
    case 'auth':
      body = (
        <PhoneAuthFlow askName={false} onExit={back} progress={(p) => (i + p) / (FLOW.length + 1)}
          phoneTitle="Your phone number" phoneSubtitle="We’ll contact you on it about your application, and you’ll sign in with it."
          onDone={() => push('name')} />
      );
      break;
    case 'name':
      body = (
        <StepFrame stepKey="name" progress={progress} title="Your name, as clients know you" subtitle="For example: Babalawo Fálànà Ifádáre."
          footer={cont(form.full_name.trim().length < 2)}>
          <input autoFocus className={field} value={form.full_name} onChange={(e) => set('full_name', e.target.value.slice(0, 120))}
            placeholder="Full name" aria-label="Full name" autoComplete="name" />
        </StepFrame>
      );
      break;
    case 'place':
      body = (
        <StepFrame stepKey="place" progress={progress} onBack={back} title="Where are you based?" footer={cont(!form.country.trim())}>
          <div className="space-y-3">
            <label className="block"><span className="mb-1.5 block text-sm font-bold">Country</span>
              <input className={field} value={form.country} onChange={(e) => set('country', e.target.value.slice(0, 80))} autoComplete="country-name" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-bold">Town or city</span>
              <input autoFocus className={field} value={form.city} onChange={(e) => set('city', e.target.value.slice(0, 80))} placeholder="e.g. Ilé-Ifẹ̀" autoComplete="address-level2" /></label>
          </div>
        </StepFrame>
      );
      break;
    case 'years':
      body = (
        <StepFrame stepKey="years" progress={progress} onBack={back} title="How long have you practised Ifá?">
          <div className="grid gap-3">
            {YEARS.map((y, n) => (
              <ChoiceCard key={y.v} title={y.label} color={pastelBlocks[n]} selected={form.years === y.v} icon={<Clock />}
                onClick={() => { set('years', y.v); push('ile'); }} />
            ))}
          </div>
        </StepFrame>
      );
      break;
    case 'ile':
      body = (
        <StepFrame stepKey="ile" progress={progress} onBack={back} title="Your ilé or lineage" subtitle="Where you were trained or initiated. Optional."
          footer={cont(false, form.ile.trim() ? 'Continue' : 'Skip')}>
          <input autoFocus className={field} value={form.ile} onChange={(e) => set('ile', e.target.value.slice(0, 200))} placeholder="e.g. Ilé Ọ̀rúnmìlà, Òyó" />
        </StepFrame>
      );
      break;
    case 'specialties':
      body = (
        <StepFrame stepKey="specialties" progress={progress} onBack={back} title="What do you help people with?" subtitle="Tap all that apply."
          footer={cont(form.specialties.length === 0)}>
          {chips(SPECIALTIES, 'specialties')}
        </StepFrame>
      );
      break;
    case 'languages':
      body = (
        <StepFrame stepKey="languages" progress={progress} onBack={back} title="Which languages do you consult in?"
          footer={cont(form.languages.length === 0)}>
          {chips(LANGUAGES, 'languages')}
        </StepFrame>
      );
      break;
    case 'online':
      body = (
        <StepFrame stepKey="online" progress={progress} onBack={back} title="Have you consulted online before?">
          <div className="grid gap-3">
            {ONLINE.map((o, n) => (
              <ChoiceCard key={o.v} icon={o.icon} title={o.title} body={o.body} color={pastelBlocks[n + 1]} selected={form.online === o.v}
                onClick={() => { set('online', o.v); push('bio'); }} />
            ))}
          </div>
        </StepFrame>
      );
      break;
    case 'bio':
      body = (
        <StepFrame stepKey="bio" progress={progress} onBack={back} title="Tell clients about yourself" subtitle="A few lines. You can change it later."
          footer={cont(false, form.bio.trim() ? 'Continue' : 'Skip')}>
          <textarea autoFocus value={form.bio} onChange={(e) => set('bio', e.target.value.slice(0, 3000))} rows={6}
            className="w-full rounded-field border-2 border-ink bg-paper p-4 text-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            placeholder="How you came to Ifá, how you work, what people come to you for." />
        </StepFrame>
      );
      break;
    case 'contact':
      body = (
        <StepFrame stepKey="contact" progress={progress} onBack={back} title="Last thing" subtitle="Both optional."
          footer={cont(!!form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email), 'Join the waitlist', submit)}>
          <div className="space-y-3">
            <label className="block"><span className="mb-1.5 block text-sm font-bold">Email</span>
              <input className={field} type="email" inputMode="email" autoComplete="email" value={form.email}
                onChange={(e) => set('email', e.target.value.trim().slice(0, 200))} placeholder="you@example.com" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-bold">How did you hear about IFA.ng?</span>
              <input className={field} value={form.referral} onChange={(e) => set('referral', e.target.value.slice(0, 300))} placeholder="A friend, WhatsApp, Instagram…" /></label>
          </div>
          <Err />
        </StepFrame>
      );
      break;
    case 'status': {
      const a = existing;
      body = (
        <StepFrame stepKey="status" progress={1} onClose={() => navigate('/')}
          title={a?.status === 'approved' ? 'You’re approved. Ẹ kú oríire!' : a?.status === 'rejected' ? 'About your application' : 'You’re on the waitlist.'}
          subtitle={a?.status === 'waitlisted' ? 'Our team reviews every application by hand. We’ll call or message you on your phone number.' : undefined}
          footer={a?.status === 'approved'
            ? <Button variant="sun" size="lg" className="w-full" onClick={() => navigate('/dashboard')}>Set up your profile</Button>
            : <Button asChild variant="outline" size="lg" className="w-full"><Link to="/">Back to IFA.ng</Link></Button>}>
          <div className="flex items-start gap-4 rounded-panel border-2 border-ink bg-paper p-5">
            {a?.status === 'approved' ? <CheckCircle2 className="h-8 w-8 flex-none text-green-700" />
              : a?.status === 'rejected' ? <XCircle className="h-8 w-8 flex-none text-coral" />
              : <Clock className="h-8 w-8 flex-none text-camwood" />}
            <div>
              <div className="font-display text-xl font-extrabold">{a?.full_name}</div>
              <div className="text-sm text-muted-foreground">Applied {a ? new Date(a.created_at).toLocaleDateString() : ''}</div>
              {a?.review_notes && <p className="mt-2">{a.review_notes}</p>}
              {a?.status === 'waitlisted' && (
                <p className="mt-2 flex items-center gap-1.5 text-sm"><MapPin className="h-4 w-4" /> Status: waiting for review</p>
              )}
            </div>
          </div>
        </StepFrame>
      );
      break;
    }
  }

  if (loading || (user && existing === undefined)) {
    return <Shell><div className="grid flex-1 place-items-center py-24"><Loader2 className="h-8 w-8 animate-spin" aria-label="Loading" /></div></Shell>;
  }
  return <Shell>{body}</Shell>;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-cloth lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-camwood text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo tone="light" />
        <div>
          <Eyebrow className="text-sun">For Babalawos</Eyebrow>
          <p className="mt-4 max-w-[14ch] font-display text-[clamp(44px,5vw,80px)] font-extrabold leading-[.9] tracking-[-0.045em]">
            Àṣẹ, from anywhere.
          </p>
        </div>
      </aside>
      <main className="flex min-h-screen flex-col">
        <div className="px-5 pt-5 lg:hidden"><Logo /></div>
        <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col">{children}</div>
      </main>
    </div>
  );
}

export default BabalawoApply;
