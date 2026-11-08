import { Eyebrow } from '@/components/brand';

/** Indigo band for the daily ẹsẹ Ifá. Content will come from the Babalawos' recordings. */
const DailyVerse = () => (
  <section id="verse" className="band bg-indigo-700 text-center text-[#f2eee2]">
    <div className="wrap">
      <Eyebrow className="text-sun">Daily verse</Eyebrow>
      <p className="mx-auto my-5 max-w-[20ch] font-display text-[clamp(30px,4.4vw,60px)] font-bold leading-[1.08] tracking-[-0.03em]">
        A new ẹsẹ Ifá each morning, chanted and explained.
      </p>
      <p className="mx-auto m-0 max-w-[56ch] text-[#c9cdea]">
        Recorded by one of our Babalawos, with the Yorùbá text and an English reading. Coming soon.
      </p>
    </div>
  </section>
);

export default DailyVerse;
