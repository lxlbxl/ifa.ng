import { Link, useSearchParams } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';
import { Eyebrow, PageShell } from '@/components/brand';
import { Button } from '@/components/ui/button';
import Support from '@/components/dashboard/user/Support';
import { useAuth } from '@/hooks/useAuth';

const ISSUES: Record<string, string> = {
  payment_failed: 'a payment that did not go through',
  payment: 'a payment',
  session: 'a consultation',
};

/**
 * Public help page at /support. It is the same answers and contact options as
 * Help & support inside the dashboard, so people can reach them signed out,
 * from a payment result, or from the footer.
 */
const SupportPage = () => {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const ref = params.get('ref');
  const issue = ISSUES[params.get('issue') ?? ''];

  return (
    <PageShell>
      <section className="wrap pt-14 md:pt-20">
        <Eyebrow className="text-camwood">We are here</Eyebrow>
        <h1 className="mt-3 max-w-[16ch] font-display text-display-lg font-extrabold leading-[0.95] tracking-[-0.03em]">
          Help &amp; <span className="text-camwood">support</span>
        </h1>
        <p className="mt-4 max-w-[52ch] text-lg text-muted-foreground">
          Answers to the questions we hear most, and a direct line to our team when you need a person.
        </p>

        {(ref || issue) && (
          <div className="mt-8 flex items-start gap-3 rounded-panel border border-line bg-paper p-5" role="status">
            <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-camwood" aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">You are asking about {issue ?? 'a payment'}.</p>
              {ref && <p className="mt-1 break-all text-muted-foreground">Quote this reference when you write to us: <span className="font-mono text-ink">{ref}</span></p>}
            </div>
          </div>
        )}
      </section>

      <section className="wrap py-10 md:py-14">
        <Support />
        <div className="mt-8 flex flex-wrap gap-3">
          {user ? (
            <Button asChild variant="sun" size="lg"><Link to="/dashboard?tab=session-history">Report a problem with a session</Link></Button>
          ) : (
            <Button asChild variant="sun" size="lg"><Link to="/auth">Sign in</Link></Button>
          )}
          <Button asChild variant="outline" size="lg"><Link to="/search">Find a Babalawo</Link></Button>
        </div>
      </section>
    </PageShell>
  );
};

export default SupportPage;
