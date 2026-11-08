import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SectionHeading } from '@/components/brand';

const faqs = [
  {
    q: 'How do I book a consultation?',
    a: 'Browse the verified Babalawos, pick one who fits, choose a time and pay securely. Your Google Meet link and calendar invite arrive once the payment is confirmed.',
  },
  {
    q: 'Are the Babalawos verified?',
    a: 'Yes. Every Babalawo is checked before they can take bookings. Each profile shows their experience, languages, specialties and fee.',
  },
  {
    q: 'Do I need to install anything?',
    a: 'No. Sessions run on Google Meet, which opens in any modern browser on your phone or computer. A stable connection, a camera and a microphone are all you need.',
  },
  {
    q: 'Is my session recorded or transcribed?',
    a: 'Only if both you and your Babalawo agree when you book, and either of you can turn it off. The transcript is used to draft your session notes, which your Babalawo approves before you see them.',
  },
  {
    q: 'Can I reschedule or cancel?',
    a: 'Yes, up to 24 hours before the session. Changes inside 24 hours may carry a fee. Contact support@ifa.ng if something goes wrong.',
  },
  {
    q: 'How do I pay?',
    a: 'By card or bank transfer through Paystack or Flutterwave, or from your IFA.ng wallet. Every fee is shown before you pay.',
  },
];

const FAQSection = () => (
  <section id="faq" className="band bg-paper">
    <div className="wrap grid gap-10 lg:grid-cols-[1fr_1.4fr]">
      <SectionHeading eyebrow="Questions" title="Good to know." lede="Anything else? Write to support@ifa.ng and a person will reply." />
      <Accordion type="single" collapsible className="border-t-2 border-ink">
        {faqs.map((f, i) => (
          <AccordionItem key={f.q} value={`q${i}`} className="border-b border-line">
            <AccordionTrigger className="py-5 text-left font-display text-xl font-bold tracking-[-0.02em] hover:no-underline">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-base text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

export default FAQSection;
