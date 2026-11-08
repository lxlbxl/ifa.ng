import { useRef } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Eyebrow, Logo, TickDot } from '@/components/brand';
import { PhoneAuthFlow } from '@/components/flow/PhoneAuthFlow';

/**
 * Sign in and sign up are the same thing now: a phone number, then the PIN
 * (returning) or a code and a new PIN (new). Babalawos apply separately at
 * /become-a-babalawo.
 */
const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || params.get('next') || '/dashboard';
  // Only bounce people who arrive already signed in; mid-flow (after the code) they still need to set a PIN.
  const arrivedSignedIn = useRef<boolean | null>(null);
  if (!loading && arrivedSignedIn.current === null) arrivedSignedIn.current = !!user;

  if (params.get('role') === 'babalawo') return <Navigate to="/become-a-babalawo" replace />;

  if (loading && arrivedSignedIn.current === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-cloth">
        <Loader2 className="h-10 w-10 animate-spin text-green-700" aria-label="Loading" />
      </div>
    );
  }
  if (arrivedSignedIn.current && user) return <Navigate to={from} replace />;

  return (
    <div className="grid min-h-screen bg-cloth lg:grid-cols-[1.05fr_1fr]">
      {/* Story panel */}
      <aside className="relative isolate hidden overflow-hidden bg-ink text-white lg:block">
        <div
          className="absolute inset-0 -z-20 animate-drift bg-cover [background-position:center_30%]"
          style={{ backgroundImage: 'url(/brand/hero-chant-poster.jpg)' }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(10,14,9,.6)_0%,rgba(10,14,9,.15)_35%,rgba(10,14,9,.92)_100%)]" />
        <div className="flex h-full flex-col justify-between p-10 xl:p-14">
          <Logo tone="light" />
          <div>
            <Eyebrow className="text-leaf">Ifá consultation, online</Eyebrow>
            <h1 className="mt-4 max-w-[11ch] font-display text-[clamp(48px,5.6vw,92px)] font-extrabold leading-[.88] tracking-[-0.045em]">
              Hear Ifá <span className="text-sun">speak.</span>
            </h1>
            <ul className="mt-8 grid max-w-md list-none gap-3 p-0 text-[15px] text-[#ece6d6]">
              {['Your phone number and a 4-digit PIN. No password.', 'Verified Babalawos only', 'Written notes from every session'].map((t, i) => (
                <li key={t} className="flex items-center gap-3">
                  <TickDot>{i + 1}</TickDot>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 sm:px-10 lg:justify-end">
          <span className="lg:hidden"><Logo /></span>
          <a href="/" className="text-sm font-semibold text-muted-foreground no-underline hover:text-ink hover:underline">← Back to IFA.ng</a>
        </div>
        <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col">
          <PhoneAuthFlow
            askName
            phoneTitle="Sign in or join with your phone"
            phoneSubtitle="Type your number. If you’ve been here before we’ll ask for your PIN; if not, we’ll text you a code."
            onDone={() => navigate(from, { replace: true })}
          />
          <p className="px-5 pb-8 text-center text-sm text-muted-foreground sm:px-8">
            Are you a Babalawo? <Link to="/become-a-babalawo" className="font-bold text-ink underline underline-offset-4">Apply to join IFA.ng</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Auth;
