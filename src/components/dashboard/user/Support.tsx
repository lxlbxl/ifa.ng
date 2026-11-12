import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageSquare } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader } from '@/components/dashboard/shell/Panel';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP, usePlatformRules } from '@/hooks/usePlatformRules';

/** Help: answers that match how the platform really works, and real ways to reach us. */
const Support = () => {
  const r = usePlatformRules();
  const faqs: [string, React.ReactNode][] = [
    ['How do I book a consultation?', <>Open a Babalawo's profile and tap Consult. Pick what it is about, then either Consult now (when they are Online) or Schedule a time. You pay by card, bank transfer or your IFA.ng wallet.</>],
    ['How do I join my consultation?', <>Open the session from your dashboard or from the link we send by WhatsApp or SMS. It opens the session page, which takes you into Google Meet. The join button opens shortly before the start. No Google account is needed.</>],
    ['What happens with Consult now?', <>You pay, and the Babalawo has {r.acceptMinutes} minutes to accept. If they do not, your money goes back to your wallet in full, automatically. You can also stop waiting and get a full refund.</>],
    ['Can I cancel?', <>Yes, from My sessions. Cancel at least {r.freeCancelHours} hours before the start for a full refund to your wallet. Later than that there is no refund. If the Babalawo cancels, you are always refunded in full.</>],
    ['What if the Babalawo does not show up?', r.noShowRefund
      ? <>If the Babalawo never joins, we refund you in full automatically about two hours after the session was due to end.</>
      : <>If the Babalawo never joins, report it from Past sessions and our team will refund you.</>],
    ['Something went wrong in my consultation', <>Go to Past sessions and tap Report a problem. While we look into it, the Babalawo is not paid for that session. Babalawos receive their earnings {r.holdHours} hours after a session, so please report within that time.</>],
    ['Is my consultation recorded?', <>Only if you and your Babalawo both agree before the session. Recordings are used to write your consultation notes, which your Babalawo approves, and are deleted after {r.recordingDays} days.</>],
    ['How are Babalawos checked?', <>Every Babalawo applies, and our team reviews them before they can take bookings. Only verified Babalawos with a complete profile appear in search.</>],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
      <Panel>
        <PanelHeader eyebrow="Answers" title="Common questions" />
        <Accordion type="single" collapsible>
          {faqs.map(([q, a], i) => (
            <AccordionItem key={q} value={`q${i}`}>
              <AccordionTrigger className="text-left">{q}</AccordionTrigger>
              <AccordionContent><p className="text-muted-foreground">{a}</p></AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-4 text-sm text-muted-foreground">
          The full rules are in our <Link className="underline" to="/terms">Terms</Link>, <Link className="underline" to="/refunds">Refund policy</Link> and{' '}
          <Link className="underline" to="/privacy">Privacy policy</Link>.
        </p>
      </Panel>
      <Panel tone="cloth">
        <PanelHeader eyebrow="Talk to us" title="Contact" />
        <p className="mb-4 text-sm text-muted-foreground">Tell us your phone number and, if it is about a consultation, its date and the Babalawo's name.</p>
        <div className="space-y-3">
          <Button asChild className="w-full justify-start">
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('IFA.ng help')}`}><Mail /> {SUPPORT_EMAIL}</a>
          </Button>
          {SUPPORT_WHATSAPP && (
            <Button asChild variant="outline" className="w-full justify-start">
              <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer"><MessageSquare /> WhatsApp us</a>
            </Button>
          )}
        </div>
      </Panel>
    </div>
  );
};

export default Support;
