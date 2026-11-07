import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Marquee, PortraitCard, SectionHeading } from '@/components/brand';
import { useFeaturedBabalawos } from '@/hooks/useBabalawoSearch';
import { BabalawoProfile } from '@/types/babalawo';
import { blockColors } from '@/design/tokens';

export const babalawoChips = (b: BabalawoProfile) => {
  const chips: string[] = [];
  if (b.languages?.length) chips.push(b.languages.slice(0, 2).join(' · '));
  else if (b.specialties?.length) chips.push(b.specialties[0]);
  if (b.experience_years) chips.push(`${b.experience_years} yrs`);
  if (b.hourly_rate) chips.push(`₦${Number(b.hourly_rate).toLocaleString()}`);
  return chips;
};

const statusOf = (b: BabalawoProfile) =>
  b.current_status === 'available' || b.current_status === 'online'
    ? 'available'
    : b.current_status === 'busy' || b.current_status === 'in_session'
      ? 'busy'
      : null;

/** "Meet the Babalawos": the right-to-left marquee of colour-block cards. */
const FeaturedBabalawos = () => {
  const { featuredBabalawos: babalawos, loading } = useFeaturedBabalawos(12);

  return (
    <section id="babalawos" aria-label="Babalawos" className="overflow-hidden pb-10 pt-[72px]">
      <SectionHeading
        className="wrap mb-8"
        layout="split"
        size="lg"
        title={<>Meet the<br />Babalawos.</>}
        lede="Each one is verified before they can take bookings. Tap a card to see their lineage, languages and fee."
      />

      {loading ? (
        <div className="flex gap-[22px] overflow-hidden px-5 pb-6 pt-4" aria-busy="true">
          {blockColors.map((c, i) => (
            <div
              key={c}
              className="h-[300px] w-[220px] flex-none animate-pulse rounded-card opacity-30 sm:h-[360px] sm:w-[268px]"
              style={{ backgroundColor: c, transform: `rotate(${i % 2 ? 2 : -2}deg)` }}
            />
          ))}
        </div>
      ) : babalawos.length === 0 ? (
        <div className="wrap">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-panel border-2 border-dashed border-line bg-paper p-8">
            <p className="m-0 max-w-[48ch] text-muted-foreground">
              Our first Babalawos are being verified now. Browse everyone who is ready to take bookings.
            </p>
            <Button asChild><Link to="/search">Browse Babalawos</Link></Button>
          </div>
        </div>
      ) : (
        <Marquee
          items={babalawos}
          label="Featured Babalawos"
          trackClassName="pb-[26px] pt-4"
          duration={Math.max(30, babalawos.length * 7.5)}
          renderItem={(b, i, isClone) => (
            <PortraitCard
              key={`${b.id}${isClone ? '-c' : ''}`}
              name={b.full_name}
              imageUrl={b.avatar_url}
              chips={babalawoChips(b)}
              status={statusOf(b)}
              color={blockColors[i % blockColors.length]}
              tilt={i % 2 ? 'right' : 'left'}
              to={`/babalawo/${b.id}`}
              tabIndex={isClone ? -1 : undefined}
            />
          )}
        />
      )}

      <div className="wrap mt-2 flex justify-end">
        <Button asChild variant="outline">
          <Link to="/search">See every Babalawo →</Link>
        </Button>
      </div>
    </section>
  );
};

export default FeaturedBabalawos;
