// Refs: src/pages/auth/SignInForm.tsx, src/pages/auth/SignUpForm.tsx
import { Navigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eyebrow, Logo, TickDot } from '@/components/brand';
import SignInForm from './auth/SignInForm';
import SignUpForm from './auth/SignUpForm';

const Auth = () => {
  const { user, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'signup' ? 'signup' : 'signin';
  const role = params.get('role') === 'babalawo' ? 'babalawo' : 'user';

  if (user && !loading) return <Navigate to="/dashboard" replace />;

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-cloth">
        <Loader2 className="h-10 w-10 animate-spin text-green-700" aria-label="Loading" />
      </div>
    );
  }

  const forBabalawo = tab === 'signup' && role === 'babalawo';

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
            <Eyebrow className="text-leaf">{forBabalawo ? 'For Babalawos' : 'Ifá consultation, online'}</Eyebrow>
            <h1 className="mt-4 max-w-[11ch] font-display text-[clamp(48px,5.6vw,92px)] font-extrabold leading-[.88] tracking-[-0.045em]">
              {forBabalawo ? (
                <>Consult the world from your <span className="text-sun">ilé.</span></>
              ) : (
                <>Hear Ifá <span className="text-sun">speak.</span></>
              )}
            </h1>
            <ul className="mt-8 grid max-w-md list-none gap-3 p-0 text-[15px] text-[#ece6d6]">
              {(forBabalawo
                ? ['Set your own fee and hours', 'Sessions run on Google Meet', 'Notes drafted for you to approve']
                : ['Verified Babalawos only', 'Meet link sent once payment clears', 'Written notes from every session']
              ).map((t, i) => (
                <li key={t} className="flex items-center gap-3">
                  <TickDot>{i + 1}</TickDot>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <span className="lg:hidden"><Logo /></span>
          <a href="/" className="text-sm font-semibold text-muted-foreground no-underline hover:text-ink hover:underline">
            ← Back to IFA.ng
          </a>
        </div>
        <div className="mx-auto my-auto w-full max-w-[440px] py-10">
          <h2 className="font-display text-display-sm font-extrabold">
            {tab === 'signin' ? 'Ẹ kú àbọ̀.' : forBabalawo ? 'Apply to join.' : 'Create your account.'}
          </h2>
          <p className="mb-7 mt-2 text-muted-foreground">
            {tab === 'signin'
              ? 'Sign in to book sessions and read your notes.'
              : forBabalawo
                ? 'We verify every Babalawo before they can take bookings.'
                : 'It takes a minute. You can book straight after.'}
          </p>
          <Tabs
            value={tab}
            onValueChange={(v) => {
              const next = new URLSearchParams(params);
              next.set('tab', v);
              setParams(next, { replace: true });
            }}
            className="w-full"
          >
            <TabsList className="mb-7 grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup">
              <SignUpForm defaultRole={role} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Auth;
