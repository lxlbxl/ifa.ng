import { Marquee } from './Marquee';
import { cn } from '@/lib/utils';

export const ODU_MEJI = [
  'Ogbè', 'Ọ̀yẹ̀kú', 'Ìwòrì', 'Òdí', 'Ìrosùn', 'Ọ̀wọ́nrín', 'Ọ̀bàrà', 'Ọ̀kànràn',
  'Ògúndá', 'Ọ̀sá', 'Ìká', 'Òtúrúpọ̀n', 'Òtúrá', 'Ìrẹtẹ̀', 'Ọ̀ṣẹ́', 'Òfún',
] as const;

/** Green band with the sixteen principal Odù scrolling left to right. */
export const OduTicker = ({ className }: { className?: string }) => (
  <div className={cn('border-y-[3px] border-ink bg-green-700 text-leaf', className)}>
    <Marquee
      items={[...ODU_MEJI]}
      direction="ltr"
      duration={60}
      gap={0}
      label="The sixteen principal Odù"
      renderItem={(name, i) => (
        <span
          key={`${name}-${i}`}
          className="whitespace-nowrap px-[22px] py-[18px] font-display text-[clamp(26px,3.6vw,44px)] font-extrabold leading-none tracking-[-0.02em]"
        >
          {name} Méjì
          <span className="ml-11 align-middle text-[0.6em] text-sun" aria-hidden="true">✦</span>
        </span>
      )}
    />
  </div>
);

export default OduTicker;
