import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowRight, Check, Printer, Share2 } from 'lucide-react';
import { Eyebrow, PageShell } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Panel } from '@/components/dashboard/shell/Panel';
import { supabase } from '@/integrations/supabase/client';
import { useUserSessions } from '@/hooks/useUserSessions';
import { toast } from '@/hooks/use-toast';
import { sessionStart } from '@/utils/sessionTime';

/**
 * /payment/success?type=session&session_id=…&ref=…  or  ?type=wallet&ref=…
 * Reads what was paid from our own records, so the page is the same whichever
 * gateway sent the person back.
 */
const PaymentSuccess: React.FC = () => {
  const [params] = useSearchParams();
  const type = params.get('type') === 'wallet' ? 'wallet' : 'session';
  const sessionId = params.get('session_id');
  const ref = params.get('ref');

  const { data: sessions } = useUserSessions();
  const session = type === 'session' && sessionId ? sessions?.find((s: any) => String(s.id) === sessionId) : undefined;

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment-result', type, sessionId, ref],
    enabled: type === 'wallet' ? !!ref : !!sessionId || !!ref,
    queryFn: async () => {
      if (type === 'wallet') {
        const { data } = await supabase.from('wallet_transactions').select('amount, payment_gateway, payment_reference').eq('payment_reference', ref!).maybeSingle();
        return data;
      }
      const q = supabase.from('payments').select('amount, payment_gateway, payment_reference');
      const { data } = await (sessionId ? q.eq('session_id', Number(sessionId)) : q.eq('payment_reference', ref!)).limit(1).maybeSingle();
      return data;
    },
  });

  const reference = ref || payment?.payment_reference || null;
  const share = async () => {
    const text = `IFA.ng payment${reference ? `, reference ${reference}` : ''}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'IFA.ng receipt', text }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard?.writeText(text);
      toast({ title: 'Reference copied' });
    }
  };

  const row = (label: string, value: React.ReactNode) => (
    <div className="min-w-0">
      <p className="eyebrow text-camwood">{label}</p>
      <p className="mt-1 break-words font-semibold">{value}</p>
    </div>
  );

  return (
    <PageShell>
      <section className="wrap max-w-[720px] py-14 md:py-20">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-leaf text-ink"><Check className="h-8 w-8" aria-hidden /></div>
        <Eyebrow className="mt-6 text-camwood">{type === 'wallet' ? 'Wallet topped up' : 'Booking confirmed'}</Eyebrow>
        <h1 className="mt-2 font-display text-display-lg font-extrabold leading-[0.95] tracking-[-0.03em]">Payment received.</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {type === 'wallet' ? 'Your money is in your IFA.ng wallet and ready to use.' : 'Your consultation is booked. We will remind you on WhatsApp or SMS before it starts.'}
        </p>

        <Panel className="mt-8">
          {session && (
            <div className="mb-5 flex items-center gap-4 border-b border-line pb-5">
              <Avatar className="h-14 w-14 border-2 border-ink">
                <AvatarImage src={session.babalawo_avatar ?? undefined} alt="" />
                <AvatarFallback className="bg-sun font-bold text-ink">{(session.babalawo_name ?? 'B').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-display text-xl font-extrabold">{session.babalawo_name}</p>
                <p className="text-sm text-muted-foreground">{format(sessionStart(session), 'EEEE d MMMM, h:mm a')}</p>
              </div>
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            {row('Amount', isLoading ? '…' : payment?.amount != null ? `₦${Number(payment.amount).toLocaleString()}` : 'Shown in your wallet')}
            {row('Paid with', <span className="capitalize">{payment?.payment_gateway || 'Card or wallet'}</span>)}
            {row('Reference', <span className="font-mono text-sm">{reference ?? 'None given'}</span>)}
            {row('Status', 'Completed')}
          </div>
        </Panel>

        <div className="mt-6 flex flex-wrap gap-3">
          {type === 'session' ? (
            <Button asChild variant="sun" size="lg"><Link to="/dashboard?tab=my-sessions">View my sessions <ArrowRight /></Link></Button>
          ) : (
            <Button asChild variant="sun" size="lg"><Link to="/dashboard?tab=transaction-history">Go to my wallet <ArrowRight /></Link></Button>
          )}
          {type === 'session' && <Button asChild variant="outline" size="lg"><Link to="/search">Book another</Link></Button>}
          <Button variant="outline" size="lg" onClick={() => window.print()}><Printer /> Print receipt</Button>
          <Button variant="outline" size="lg" onClick={share}><Share2 /> Share</Button>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Something not right? <Link className="underline" to={`/support${reference ? `?ref=${encodeURIComponent(reference)}&issue=payment` : ''}`}>Contact support</Link>.
        </p>
      </section>
    </PageShell>
  );
};

export default PaymentSuccess;
