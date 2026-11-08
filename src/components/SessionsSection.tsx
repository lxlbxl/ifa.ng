import { Eyebrow, StickerPanel, TickDot } from '@/components/brand';

const ticks = [
  ['One link, sent after payment clears', 'Your Meet link and calendar invite arrive once the payment is confirmed.'],
  ['Transcribed, only with consent', 'Both of you agree at booking. Either side can turn it off.'],
  ['Notes your Babalawo signs off', 'The Odù, the ẹbọ, items to gather and the deadline, in one place.'],
];

/** "Every consultation, remembered." Google Meet call next to its approved notes. */
const SessionsSection = () => (
  <section id="sessions" className="band bg-paper">
    <div className="wrap grid items-center gap-14 lg:grid-cols-[1fr_1.15fr]">
      <div className="min-w-0">
        <Eyebrow className="text-camwood">Sessions on Google Meet</Eyebrow>
        <h2 className="mt-3.5 font-display text-[clamp(40px,5.4vw,76px)] font-extrabold leading-[.95] tracking-[-0.04em]">
          Every consultation, <em className="not-italic text-camwood">remembered.</em>
        </h2>
        <p className="mb-7 mt-5 max-w-[52ch] text-lg text-muted-foreground">
          You join on Google Meet from your phone or laptop, with no app to install. With both sides' consent, the session is
          transcribed, and your Babalawo approves a written summary before it reaches you.
        </p>
        <ul className="m-0 grid list-none gap-3.5 p-0">
          {ticks.map(([title, body], i) => (
            <li key={title} className="grid grid-cols-[30px_1fr] items-start gap-3">
              <TickDot>{i + 1}</TickDot>
              <span>
                <b className="block">{title}</b>
                {body}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative min-w-0" aria-label="Example of a session and its notes">
        <div className="rounded-[24px] bg-meet p-3.5 text-[#e8eaed] shadow-float">
          <div className="flex items-center gap-2 px-1.5 pb-3 pt-0.5 text-xs">
            <span className="truncate">meet.google.com/ifa-kdx-wpq</span>
            <span className="ml-auto flex items-center gap-1.5 rounded-pill bg-[#3c4043] px-2.5 py-1">
              <span className="h-2 w-2 rounded-full bg-[#ea4335]" />
              Transcribing
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1.4fr_1fr]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-[#3c4043]">
              <img src="/brand/hero-chant-poster.jpg" alt="" className="h-full w-full object-cover [object-position:center_25%]" />
              <span className="absolute bottom-2 left-2.5 rounded-md bg-black/55 px-2 py-0.5 text-xs">Your Babalawo</span>
            </div>
            <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[14px] bg-[#5f4b8b]">
              <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-[#e1d7fb] font-display text-[28px] font-extrabold text-[#3b2a6a]">T</span>
              <span className="absolute bottom-2 left-2.5 rounded-md bg-black/55 px-2 py-0.5 text-xs">You</span>
            </div>
          </div>
          <div className="mt-2.5 rounded-[10px] bg-black/45 px-3 py-2.5 text-[13px]">
            <b className="text-[#8ab4f8]">Babalawo:</b> Ogbè Ìwòrì has come out for you. Before the next new moon, we will…
          </div>
        </div>

        <StickerPanel tilt className="relative mx-auto -mt-8 w-[min(380px,92%)] sm:-mr-2.5 sm:-mt-[60px] sm:ml-auto">
          <h3 className="flex items-center justify-between gap-2.5 font-display text-xl font-extrabold tracking-[-0.02em]">
            Session notes
            <small className="rounded-pill bg-leaf px-2.5 py-1 font-sans text-[11px] font-bold tracking-[0.04em]">APPROVED</small>
          </h3>
          <dl className="m-0 mt-3.5 grid gap-2.5 text-sm">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Odù</dt>
              <dd className="m-0 mt-0.5">Ogbè Ìwòrì</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Agreed actions</dt>
              <dd className="check-item m-0 mt-0.5">Offer ẹbọ as discussed before the deadline</dd>
              <dd className="check-item m-0 mt-0.5">Gather: kola nut, palm oil, white cloth</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Next session</dt>
              <dd className="m-0 mt-0.5">Follow-up in two weeks</dd>
            </div>
          </dl>
          <div className="mt-3.5 flex items-center gap-2 border-t border-dashed border-line pt-3 text-xs text-muted-foreground">
            ✓ Reviewed by your Babalawo · example notes
          </div>
        </StickerPanel>
      </div>
    </div>
  </section>
);

export default SessionsSection;
