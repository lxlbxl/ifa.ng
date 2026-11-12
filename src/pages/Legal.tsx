import React from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow, PageShell } from '@/components/brand';
import { SUPPORT_EMAIL, usePlatformRules, usePrivacyContacts } from '@/hooks/usePlatformRules';
import { openPrivacyChoices } from '@/components/privacy/CookieNotice';

type Doc = 'terms' | 'privacy' | 'refunds' | 'cookies';
const UPDATED = '17 November 2026';

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
        'You must be 18 or older to create an account, book or give consultations.',
        'Give true details. We may suspend accounts used for fraud, abuse or to harm others.',
        <>You can download your data or delete your account at any time in Settings. See the <Link className="underline" to="/privacy">Privacy policy</Link> for what is kept and your rights.</>,
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
        'What clients share with you is confidential and sensitive. Use it only to guide them, keep it secure, never record or copy a consultation outside IFA.ng, and never share it with anyone else.',
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

/** A simple two-or-more column table that stays readable on a phone (it scrolls sideways inside itself). */
const T = ({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) => (
  <div className="mt-4 overflow-x-auto rounded-field border border-line">
    <table className="w-full min-w-[560px] border-collapse text-left text-[15px] leading-snug">
      <thead className="bg-cloth"><tr>{head.map((h) => <th key={h} className="border-b border-line px-3 py-2 font-bold">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="align-top">{r.map((c, j) => <td key={j} className="border-b border-line px-3 py-2">{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);
const Dpo = () => { const c = usePrivacyContacts(); return <a className="underline" href={`mailto:${c.dpoEmail}`}>{c.dpoEmail}</a>; };

/** Processors and other recipients. Keep in step with docs/privacy/SUBPROCESSORS.md. */
const RECIPIENTS: [string, string, string, string][] = [
  ['Our server host (virtual private server)', 'Runs the app and database; holds all account and consultation data', 'United Kingdom or Germany', 'UK/EU law; NDPA transfer safeguards'],
  ['Cloudflare (R2 storage, network)', 'Stores photos, recordings and Ebo videos (private, encrypted); protects the site', 'Global network; storage region set by us', 'Standard contractual clauses; EU–US Data Privacy Framework'],
  ['Paystack, Flutterwave', 'Take card, bank and transfer payments', 'Nigeria (and their own providers)', 'Nigerian law; their own safeguards'],
  ['Google (Meet, Workspace)', 'Video consultations and their recordings, booking email', 'United States and other countries', 'Standard contractual clauses; EU–US Data Privacy Framework'],
  ['Agora', 'Backup video when Meet is unavailable (not recorded by us)', 'United States and other countries', 'Standard contractual clauses'],
  ['Termii (and Meta WhatsApp through it)', 'Sign-in codes, booking messages and reminders', 'Nigeria; WhatsApp worldwide', 'Nigerian law; standard contractual clauses'],
  ['OpenAI, Anthropic', 'Transcribe recordings you agreed to and draft notes for your Babalawo to check', 'United States', 'Standard contractual clauses; business terms that do not allow training on our data'],
  ['Sentry', 'Crash reports, if you allow them (no account details)', 'United States or EU', 'Standard contractual clauses'],
  ['Our email provider', 'Account and booking emails, when you give an email', 'Depends on provider', 'Standard contractual clauses'],
  ['Browser push services (Google, Apple, Mozilla)', 'Deliver notifications to your device if you turn them on', 'United States and other countries', 'Needed to deliver what you asked for'],
];

function Privacy() {
  const r = usePlatformRules();
  const c = usePrivacyContacts();
  const ret = r.retention;
  return (
    <>
      <P>
        This policy explains what personal data IFA.ng collects, why, who we share it with, how long we keep it, and your rights. It is
        written for everyone who uses IFA.ng, in Nigeria and abroad. It follows the Nigeria Data Protection Act 2023 (NDPA) and the
        Nigeria Data Protection Commission's General Application and Implementation Directive (GAID) 2025 and, for people in the
        European Union, the European Economic Area or the United Kingdom, the EU General Data Protection Regulation and the UK GDPR.
      </P>
      <div className="mt-6 rounded-panel border-2 border-ink bg-sun/30 p-5">
        <p className="m-0 font-display text-lg font-extrabold">In short</p>
        <L items={[
          'We collect what we need to book and hold consultations, take payments and keep the platform safe.',
          'What you share in a consultation can reveal your spiritual or religious beliefs and your health. We use it only with your explicit consent, and only to give you guidance.',
          'A consultation is recorded only if you and your Babalawo both agree. AI drafts notes from it; your Babalawo checks them. You can withdraw and have the recording deleted.',
          'We never sell your data, and we use no advertising or tracking cookies.',
          'In Settings you can download your data, change your choices and delete your account, yourself, at any time.',
        ]} />
      </div>

      <H>1. Who we are</H>
      <P>
        {c.controllerName}{c.rcNumber ? ` (RC ${c.rcNumber})` : ''}{c.controllerAddress ? `, ${c.controllerAddress}` : ''} runs IFA.ng and is the
        data controller: we decide how your data is used and are responsible for it.
        {c.ndpcRegistration ? ` We are registered with the Nigeria Data Protection Commission (${c.ndpcRegistration}).` : ''}
      </P>
      <P>
        Data Protection Officer{c.dpoName ? `: ${c.dpoName}` : ''}, <Dpo />. Write to the DPO about anything in this policy.
        {c.euRepresentative && <> Our representative in the EU (GDPR Article 27): {c.euRepresentative}.</>}
        {c.ukRepresentative && <> Our representative in the UK (UK GDPR Article 27): {c.ukRepresentative}.</>}
      </P>
      <P>
        Babalawos are independent. During a consultation, your Babalawo also receives what you share and must keep it confidential and
        use it only to guide you. IFA.ng sets the rules for how they use the platform.
      </P>

      <H>2. What we collect</H>
      <T head={['What', 'Examples', 'Where it comes from']} rows={[
        ['Account', 'Phone number, first name, photo if you add one, time zone, a scrambled (hashed) version of your PIN', 'You'],
        ['Consultations', 'Babalawo, date and time, the topic you pick, messages about the booking, notes your Babalawo writes and approves, Ebo and Etutu quotes, reviews, problems you report', 'You, your Babalawo'],
        ['Recordings and transcripts', 'Audio of the consultation and a written transcript, only when both of you agree', 'Google Meet, or your Babalawo\'s upload'],
        ['Payments', 'Amounts, references, status, wallet balance. Card details go straight to Paystack or Flutterwave; we never see or store them.', 'You, payment providers'],
        ['Babalawos', 'Application details, bank account for payouts, Google email for Meet, availability, earnings', 'The Babalawo'],
        ['Messages and devices', 'WhatsApp and SMS delivery status, push notification address for each device you turn on', 'Our providers, your device'],
        ['Security and technical', 'IP address and device type when you sign in, sign-in codes (hashed), crash reports if you allow them', 'Your device'],
        ['Your choices', 'What you agreed to and when, with the policy version; your privacy requests', 'You'],
      ]} />

      <H>3. Sensitive data</H>
      <P>
        Ifá consultation is spiritual. What you tell your Babalawo, and the notes and Odù from your reading, can reveal your religious or
        philosophical beliefs and sometimes your health, family or sex life. The law treats this as sensitive (NDPA section 30; GDPR
        Article 9). We process it only because you give explicit consent when you start using IFA.ng, and only to provide your
        consultations. You can withdraw that consent in Settings at any time; you then can't book new consultations, and you can ask us to
        erase what you shared. We do not use sensitive data for marketing, profiling or anything else.
      </P>

      <H>4. Why we use your data, and our legal basis</H>
      <T head={['Purpose', 'Legal basis (NDPA s.25 / GDPR Art. 6 and 9)']} rows={[
        ['Create and run your account, sign you in', 'Contract with you'],
        ['Book, hold and follow up consultations; write and share notes', 'Contract with you; explicit consent for consultation content'],
        ['Record, transcribe and draft notes with AI', 'Your consent, given by both people before each consultation, withdrawable'],
        ['Take payments, refund, pay Babalawos, keep accounts', 'Contract; legal obligation (tax and company law)'],
        ['Booking messages and reminders by WhatsApp, SMS, push and email', 'Contract; you can turn WhatsApp, SMS and push off'],
        ['News and offers', 'Your consent (off unless you turn it on)'],
        ['Prevent fraud and abuse, keep the platform secure, handle disputes', 'Our legitimate interests in a safe, trusted service; legal claims'],
        ['Crash reports', 'Our legitimate interest in a working app; you can turn them off'],
        ['Answer regulators, courts and law enforcement where the law requires', 'Legal obligation'],
      ]} />
      <P>Where we rely on legitimate interests, we have weighed them against your rights. You can object (see section 9).</P>

      <H>5. Recordings, transcripts and AI</H>
      <L items={[
        'Before each consultation, you and your Babalawo each choose whether it may be recorded and whether AI may draft notes. Nothing is recorded unless both say yes.',
        'After the consultation, the recording is transcribed, in English and Yorùbá, and an AI service drafts notes. Your Babalawo reads, corrects and approves them before you see them. No decision about you is made by a computer alone.',
        `Recordings and transcripts are deleted after ${r.recordingDays} days. Approved notes stay with your account until you delete it.`,
        'You can withdraw at any time in Settings → Your privacy. We then delete the recordings and transcripts, and stop any that are being processed.',
        'The AI providers process the audio and text only to give us the result, under business terms that do not allow them to train their models on it.',
      ]} />

      <H>6. Who we share it with</H>
      <P>
        Your Babalawo (or your client) sees your first name and the consultation details. Our providers below process data for us under
        contracts that limit them to our instructions. We may also share data when the law requires it, to protect someone's safety, or if
        IFA.ng's business is transferred (you would be told). We never sell your data.
      </P>
      <T head={['Who', 'What for', 'Where', 'Safeguard for transfers']} rows={RECIPIENTS.map((x) => x)} />

      <H>7. International transfers</H>
      <P>
        IFA.ng serves people in Nigeria and in the diaspora, and our servers are in the United Kingdom or Germany, so your data travels
        outside the country you are in. For data from Nigeria we rely on the NDPA's rules for transfers (sections 41 to 43 and the GAID):
        countries with adequate protection, or contractual and other safeguards, after an assessment of the risks. For data from the EU,
        EEA and UK we rely on adequacy decisions (the UK and EU recognise each other; the EU–US Data Privacy Framework for certified US
        companies) or on standard contractual clauses and the UK addendum. Ask the DPO for a copy of the safeguards.
      </P>

      <H>8. How long we keep it</H>
      <T head={['Data', 'Kept for']} rows={[
        ['Account and profile', 'Until you delete your account'],
        ['Consultation notes and Ebo details', 'Until you delete your account, or ask us to erase them'],
        ['Recordings and transcripts', `${r.recordingDays} days, or until you withdraw consent`],
        ['Ebo proof videos', `${ret.eboProofDays} days after the Ebo is closed`],
        ['Payments, wallet, refunds and payouts', `${ret.financialYears} years (tax and company law), without your name after you delete your account`],
        ['In-app notifications', `${ret.notificationsDays} days`],
        ['WhatsApp and SMS delivery logs', `${ret.messageLogDays} days`],
        ['Sign-in codes, expired sign-ins, IP addresses', `${ret.securityLogDays} days at most`],
        ['Session join and leave logs', `${ret.sessionLogDays} days`],
        ['Declined Babalawo applications', `${ret.applicationsDays} days`],
        ['Privacy requests and what you agreed to', `${ret.requestsYears} years after the request, or while you have an account; consent records as long as we rely on them`],
        ['Admin and payment audit logs', `${ret.auditYears} years`],
        ['Backups', 'Up to 30 days, then overwritten'],
      ]} />
      <P>
        Deletion runs automatically every hour. When you delete your account, we remove your name, phone number, photo and sign-in, your
        consultation notes, recordings and transcripts. Payment records stay, without your details, for as long as the law requires.
      </P>

      <H>9. Your rights</H>
      <P>Under the NDPA (sections 34 to 38) and, where it applies, the GDPR, you have the right to:</P>
      <L items={[
        <><b>be informed</b> about how we use your data (this policy);</>,
        <><b>access</b> your data and get a copy. Settings → Your privacy → Download my data gives it to you straight away;</>,
        <><b>rectify</b> data that is wrong. Change your name in Settings, or ask us;</>,
        <><b>erase</b> your data. Delete your account in Settings, or ask us;</>,
        <><b>restrict</b> how we use it while something is checked;</>,
        <><b>data portability</b>: your data in a machine-readable file (the download is JSON);</>,
        <><b>object</b> to processing based on legitimate interests, and to direct marketing at any time;</>,
        <><b>not be subject to decisions made only by a computer</b> that affect you significantly. We make none;</>,
        <><b>withdraw consent</b> at any time, without affecting what was done before;</>,
        <><b>complain</b> to a regulator (section 14).</>,
      ]} />
      <P>
        Use <Link className="underline" to="/privacy/request">Your data rights</Link>, Settings → Your privacy, or email <Dpo />. It's free.
        We answer within {r.dsarDays} days; for complex requests we may take up to two months more and will tell you why. Before releasing or
        deleting anything for someone who isn't signed in, we check it's really you.
      </P>

      <H>10. Children</H>
      <P>
        IFA.ng is for adults. You must be {c.minAge} or older to create an account, book or give consultations, and we ask you to confirm
        this. We do not knowingly collect data from children. If you think a child has used IFA.ng, tell us at <Dpo /> and we will delete
        their data.
      </P>

      <H>11. Cookies</H>
      <P>
        We use only what IFA.ng needs to work: a sign-in cookie and a few settings saved in your browser. No advertising or tracking
        cookies. See the <Link className="underline" to="/cookies">Cookie policy</Link>.
      </P>

      <H>12. Security</H>
      <L items={[
        'Everything travels encrypted (HTTPS). Stored files are private and are only opened through links that expire.',
        'PINs and sign-in codes are stored only as hashes. Provider keys are encrypted. Staff access is limited to admins who need it, and admin actions are logged.',
        'Database access is limited row by row, so people see only their own data.',
        'We back up daily and test that backups restore.',
      ]} />

      <H>13. If something goes wrong</H>
      <P>
        If a breach could put your rights at risk, we tell the Nigeria Data Protection Commission within 72 hours of finding out (and the
        UK or EU regulator if people there are affected), and we tell you without delay if the risk to you is high, with what happened and
        what you can do.
      </P>

      <H><span id="complaints">14. Complaints</span></H>
      <P>
        Please talk to us first at <Dpo />. You can also complain to the Nigeria Data Protection Commission
        (<a className="underline" href="https://ndpc.gov.ng" target="_blank" rel="noreferrer">ndpc.gov.ng</a>); in the UK, the Information
        Commissioner's Office (<a className="underline" href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">ico.org.uk</a>);
        in the EU or EEA, the data protection authority where you live or work
        (<a className="underline" href="https://www.edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noreferrer">list of authorities</a>).
      </P>

      <H>15. Changes</H>
      <P>
        When we change this policy in a way that matters, we update the date and version at the top and ask you to read and agree again
        the next time you use IFA.ng. Current version: {c.noticeVersion || UPDATED}.
      </P>
    </>
  );
}

function Cookies() {
  return (
    <>
      <P>
        Cookies are small files a website saves in your browser; local storage is a similar place for settings. This page lists every
        one IFA.ng uses. We use no advertising, analytics or tracking cookies, and no social media pixels. Our fonts are served from our
        own site, so loading a page does not send your address to anyone else.
      </P>
      <H>Strictly necessary</H>
      <P>These make IFA.ng work, so they don't need your consent. You can block them in your browser, but you won't be able to sign in.</P>
      <T head={['Name', 'Type', 'What it does', 'How long']} rows={[
        ['ifa.session_token', 'Cookie, secure, not readable by scripts', 'Keeps you signed in', 'Until you sign out, at most 30 days'],
        ['ifa.privacy-choices.v1', 'Local storage', 'Remembers your choices on this notice', 'Until you clear it'],
        ['ifa-browser-advice-dismissed-at', 'Local storage', 'Hides the "use another browser" tip for 3 days', 'Until you clear it'],
        ['babalawo-onboarding', 'Local storage', 'Babalawos only: remembers the setup checklist', 'Until you clear it'],
        ['sidebar_state', 'Cookie', 'Admin screens: whether the side menu is open', '7 days'],
        ['App files (service worker cache)', 'Browser cache', 'Lets the app open quickly and work on a weak connection', 'Until updated'],
      ]} />
      <H>Optional</H>
      <T head={['What', 'What it does', 'Your choice']} rows={[
        ['Crash reports (Sentry)', 'If the app breaks, sends the error, the page and your browser type. No cookies, no account details.', 'On unless you turn it off in Privacy choices'],
        ['Push notifications', 'Your browser gives us an address to send booking alerts to this device.', 'Only if you turn them on'],
      ]} />
      <H>Payment pages</H>
      <P>
        When you pay, Paystack or Flutterwave open their own secure checkout, which uses its own cookies to prevent fraud. Their privacy
        policies apply there.
      </P>
      <H>Your choices</H>
      <P>
        Use <button type="button" className="underline" onClick={openPrivacyChoices}>Privacy choices</button> (also at the bottom of every
        page) to change what this browser sends. Questions: <Dpo />.
      </P>
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
  cookies: { title: 'Cookie policy', body: Cookies },
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
