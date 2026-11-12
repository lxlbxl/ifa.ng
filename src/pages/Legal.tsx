import React from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow, PageShell } from '@/components/brand';
import { SUPPORT_EMAIL, usePlatformRules } from '@/hooks/usePlatformRules';

type Doc = 'terms' | 'privacy' | 'refunds';
const UPDATED = '12 November 2026';

const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-10 font-display text-2xl font-extrabold tracking-[-0.02em]">{children}</h2>;
const P = ({ children }: { children: React.ReactNode }) => <p className="mt-3 leading-relaxed">{children}</p>;
const L = ({ items }: { items: React.ReactNode[] }) => <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
const Mail = () => <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

function Terms() {
  const r = usePlatformRules();
  return (
    <>
      <P>These terms apply when you use IFA.ng, as a client or as a Babalawo. By creating an account or paying for a consultation you agree to them.</P>
      <H>What IFA.ng is</H>
      <P>IFA.ng connects people with independent, verified Babalawos for consultations over video. Babalawos are not our employees; each one is responsible for the guidance they give. Ifá consultation is spiritual guidance. It is not medical, legal or financial advice, and it does not replace a doctor, lawyer or other professional.</P>
      <H>Your account</H>
      <L items={[
        'You sign in with your phone number, a code we send by SMS, and a PIN you choose. Keep your PIN to yourself.',
        'You must be 18 or older to book or give consultations.',
        'Give true details. We may suspend accounts used for fraud, abuse or to harm others.',
        <>You can delete your account at any time in Settings. See the <Link className="underline" to="/privacy">Privacy policy</Link> for what is kept.</>,
      ]} />
      <H>Booking and paying</H>
      <L items={[
        'The price is shown before you pay. You pay IFA.ng, by card, bank transfer or wallet, through Paystack or Flutterwave.',
        `IFA.ng keeps a platform share (currently ${r.commissionPercent}%) and holds the rest for the Babalawo. Babalawos receive their earnings ${r.holdHours} hours after a consultation, unless a problem has been reported.`,
        `Consult now: the Babalawo has ${r.acceptMinutes} minutes to accept. If they do not, you are refunded in full.`,
        <>Cancellations, missed sessions and refunds follow the <Link className="underline" to="/refunds">Refund policy</Link>.</>,
        'Ebo and Etutu are quoted by your Babalawo in the app. You choose whether to accept and pay. The quote shows what it covers and any platform fee.',
      ]} />
      <H>During a consultation</H>
      <L items={[
        'Consultations take place on Google Meet, or our backup video if Meet is unavailable.',
        'A consultation is recorded only if both of you agree beforehand, and you can withdraw that agreement.',
        'Be respectful. Harassment, threats, requests for payment outside IFA.ng, and sharing someone else\'s private information are not allowed.',
      ]} />
      <H>For Babalawos</H>
      <L items={[
        'You apply, and we verify you before you can take bookings. You keep your hours, price and profile accurate.',
        'You join consultations you accept on time. If you do not join, the client is refunded.',
        'Payments go through IFA.ng only. You must not ask clients to pay you directly for consultations booked here.',
        'You withdraw your earnings to a Nigerian bank account in your own name.',
      ]} />
      <H>Liability</H>
      <P>We work to keep IFA.ng available and secure, but we can't promise it will never be interrupted. To the extent the law allows, IFA.ng is not liable for decisions you make based on a consultation, or for losses beyond the amount you paid for the consultation concerned. Nothing here limits rights you have under Nigerian consumer protection law.</P>
      <H>Changes and contact</H>
      <P>We may update these terms. If a change matters, we will tell you in the app before it applies. Questions: <Mail />. These terms are governed by the laws of the Federal Republic of Nigeria.</P>
    </>
  );
}

function Privacy() {
  const r = usePlatformRules();
  return (
    <>
      <P>This explains what personal information IFA.ng collects, why, and your rights under the Nigeria Data Protection Act 2023 and, where it applies to you, the GDPR.</P>
      <H>What we collect</H>
      <L items={[
        'Account: your phone number, name, photo if you add one, and your time zone.',
        'Consultations: who, when, what it was about, the notes your Babalawo writes and approves, Ebo quotes, reviews and reports.',
        'Payments: amounts, references and status. Card details go directly to Paystack or Flutterwave; we never see or store them.',
        'Recordings, only when both people agree: the audio of the consultation, used to draft notes.',
        'Technical: your device type and IP address, for security and to fix problems.',
        'Babalawos also give us their bank details, Google email and application information.',
      ]} />
      <H>Why we use it</H>
      <L items={[
        'To run your account, book and hold consultations, take payments and pay Babalawos (performing our contract with you).',
        'To send booking messages and reminders by WhatsApp, SMS and push notification. You can turn WhatsApp and SMS reminders off in Settings.',
        'To keep the platform safe, prevent fraud and handle disputes (our legitimate interest).',
        'To keep financial records the law requires (legal obligation).',
        'To record and transcribe a consultation (your consent, which you can withdraw).',
      ]} />
      <H>Who we share it with</H>
      <P>Only what each service needs: your Babalawo or client (name and consultation details), Paystack and Flutterwave (payments), Google (Meet calls), Termii and Meta WhatsApp (messages), our hosting and storage providers, and AI services that transcribe and draft notes from recordings you agreed to. We do not sell your information. Some of these providers process data outside Nigeria, under contracts that protect it.</P>
      <H>How long we keep it</H>
      <L items={[
        `Recordings and uploaded audio: deleted after ${r.recordingDays} days.`,
        'Payment and consultation records: kept for as long as tax and accounting law requires (generally six years).',
        'Account details: until you delete your account. We then remove your name, phone number, photo and sign-in, and keep records without them.',
      ]} />
      <H>Your rights</H>
      <P>You can ask to see, correct, move or delete your information, object to how we use it, or withdraw consent at any time. Email <Mail /> and we will reply within 30 days. You can also complain to the Nigeria Data Protection Commission.</P>
      <H>Security</H>
      <P>Data is encrypted in transit, access is limited to staff who need it, and keys and passwords live only on our servers. If a breach affects you, we will tell you and the regulator as the law requires.</P>
    </>
  );
}

function Refunds() {
  const r = usePlatformRules();
  return (
    <>
      <P>Refunds go back to your IFA.ng wallet straight away, where you can use them for another consultation. To have money sent back to your card or bank instead, email <Mail />.</P>
      <H>When you are refunded in full</H>
      <L items={[
        `You cancel at least ${r.freeCancelHours} hours before a booked consultation.`,
        'The Babalawo or IFA.ng cancels the consultation.',
        `You use Consult now and the Babalawo does not accept within ${r.acceptMinutes} minutes, or you stop waiting before they accept.`,
        r.noShowRefund ? 'The Babalawo never joins. This is refunded automatically about two hours after the session was due to end.' : 'The Babalawo never joins and you report it.',
        'We agree that a problem you reported means the consultation did not happen as it should have.',
      ]} />
      <H>When there is no refund</H>
      <L items={[
        `You cancel less than ${r.freeCancelHours} hours before the start.`,
        'You do not join a consultation the Babalawo attended.',
      ]} />
      <H>Reporting a problem</H>
      <P>Go to Past sessions in your dashboard and tap Report a problem. Please do this within {r.holdHours} hours of the consultation: the Babalawo's earnings stay on hold while we look into it. We reply by SMS or WhatsApp, usually within two working days.</P>
      <H>Ebo and Etutu</H>
      <P>If your Babalawo cannot perform a paid Ebo or Etutu, or it is cancelled before it is performed, you are refunded. Once you confirm it was performed, it can't be refunded unless we find something went wrong.</P>
      <H>Wallet top-ups</H>
      <P>Money you add to your wallet is for consultations and Ebo on IFA.ng. Email <Mail /> if you need an unused top-up returned.</P>
    </>
  );
}

const DOCS: Record<Doc, { title: string; body: () => JSX.Element }> = {
  terms: { title: 'Terms of use', body: Terms },
  privacy: { title: 'Privacy policy', body: Privacy },
  refunds: { title: 'Refund and cancellation policy', body: Refunds },
};

const Legal = ({ doc }: { doc: Doc }) => {
  const d = DOCS[doc];
  const Body = d.body;
  return (
    <PageShell>
      <article className="wrap max-w-[760px] py-16 md:py-20">
        <Eyebrow className="text-camwood">Last updated {UPDATED}</Eyebrow>
        <h1 className="mt-3 font-display text-display-lg font-extrabold leading-[0.95] tracking-[-0.03em]">{d.title}</h1>
        <div className="text-[17px] text-ink/90"><Body /></div>
        <nav className="mt-12 flex flex-wrap gap-4 border-t border-line pt-6 text-sm">
          {(Object.keys(DOCS) as Doc[]).filter((k) => k !== doc).map((k) => <Link key={k} className="underline" to={`/${k}`}>{DOCS[k].title}</Link>)}
        </nav>
      </article>
    </PageShell>
  );
};

export default Legal;
