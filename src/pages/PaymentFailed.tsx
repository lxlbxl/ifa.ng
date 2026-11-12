import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { Eyebrow, PageShell } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/dashboard/shell/Panel';
import { SUPPORT_EMAIL } from '@/hooks/usePlatformRules';

const REASONS: Record<string, { title: string; body: string; next: string }> = {
  insufficient_funds: { title: 'Not enough funds', body: 'Your card or account does not have enough for this payment.', next: 'Try another card, or top up your IFA.ng wallet and pay from it.' },
  card_declined: { title: 'Card declined', body: 'Your bank declined the card.', next: 'Contact your bank, or try a different card or a bank transfer.' },
  network_error: { title: 'Connection problem', body: 'The payment could not finish because the connection dropped.', next: 'Check your internet and try again. If money left your account, it will be returned or applied automatically.' },
  timeout: { title: 'Payment timed out', body: 'The payment window expired before it was completed.', next: 'Start again and finish the payment within the time shown.' },
  cancelled: { title: 'Payment cancelled', body: 'You closed the payment before it finished. Nothing was charged.', next: 'You can try again whenever you are ready.' },
};

/** /payment/failed?type=session|wallet&error=…&ref=… */
const PaymentFailed: React.FC = () => {
  const [params] = useSearchParams();
  const type = params.get('type') === 'wallet' ? 'wallet' : 'session';
  const error = params.get('error') ?? '';
  const ref = params.get('ref');
  const reason = REASONS[error] ?? {
    title: 'Payment did not go through',
    body: error && !/^[a-z_]+$/.test(error) ? error : 'The payment was not completed. Nothing was kept from you for a failed payment.',
    next: 'Please try again. If it keeps failing, write to us and we will sort it out.',
  };

  return (
    <PageShell>
      <section className="wrap max-w-[720px] py-14 md:py-20">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-coral text-white"><X className="h-8 w-8" aria-hidden /></div>
        <Eyebrow className="mt-6 text-camwood">Payment not completed</Eyebrow>
        <h1 className="mt-2 font-display text-display-lg font-extrabold leading-[0.95] tracking-[-0.03em]">{reason.title}.</h1>
        <p className="mt-4 text-lg text-muted-foreground">{reason.body}</p>

        <Panel className="mt-8 space-y-4">
          <div>
            <p className="eyebrow text-camwood">What to do</p>
            <p className="mt-1">{reason.next}</p>
          </div>
          {ref && (
            <div>
              <p className="eyebrow text-camwood">Reference</p>
              <p className="mt-1 break-all font-mono text-sm">{ref}</p>
              <p className="mt-1 text-xs text-muted-foreground">Quote this if you contact us.</p>
            </div>
          )}
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Check your internet connection.</li>
            <li>Make sure the account has enough money.</li>
            <li>Try a different card, bank transfer or your wallet.</li>
          </ul>
        </Panel>

        <div className="mt-6 flex flex-wrap gap-3">
          {type === 'wallet' ? (
            <Button asChild variant="sun" size="lg"><Link to="/dashboard?tab=transaction-history">Try again <ArrowRight /></Link></Button>
          ) : (
            <Button asChild variant="sun" size="lg"><Link to="/search">Choose a Babalawo again <ArrowRight /></Link></Button>
          )}
          <Button asChild variant="outline" size="lg">
            <Link to={`/support?issue=payment_failed${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`}>Contact support</Link>
          </Button>
        </div>
        <p className="mt-8 text-sm text-muted-foreground">Or write to <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      </section>
    </PageShell>
  );
};

export default PaymentFailed;
