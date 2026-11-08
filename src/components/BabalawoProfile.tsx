import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, Clock, Globe, Star, Video, Zap } from 'lucide-react';
import { useBabalawoById } from '@/hooks/useBabalawoById';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Eyebrow, PageShell, PortraitCard, StickerPanel, TickDot } from '@/components/brand';
import { pickBlock } from '@/design/tokens';
import BookSessionModal from './dashboard/user/BookSessionModal';
import InstantConsultationModal from './dashboard/user/InstantConsultationModal';

const BabalawoProfile = () => {
  const { babalawoId } = useParams<{ babalawoId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { babalawo, loading, error } = useBabalawoById(babalawoId);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showInstantModal, setShowInstantModal] = useState(false);

  if (loading) {
    return (
      <PageShell>
        <div className="wrap grid gap-10 py-14 md:grid-cols-[320px_1fr]" aria-busy="true">
          <div className="aspect-[4/5] animate-pulse rounded-card bg-line" />
          <div className="space-y-4">
            <div className="h-4 w-32 animate-pulse rounded-pill bg-line" />
            <div className="h-16 w-3/4 animate-pulse rounded-panel bg-line" />
            <div className="h-24 w-full animate-pulse rounded-panel bg-line" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (error || !babalawo) {
    return (
      <PageShell>
        <div className="wrap py-24 text-center">
          <h1 className="font-display text-display-md font-extrabold">We couldn't find that Babalawo.</h1>
          <p className="mt-3 text-muted-foreground">The profile may have moved or is not taking bookings yet.</p>
          <Button asChild variant="sun" size="lg" className="mt-8">
            <Link to="/search">See every Babalawo</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const name = babalawo.full_name || 'Babalawo';
  const fee = babalawo.hourly_rate ? Number(babalawo.hourly_rate) : 15000;
  const color = pickBlock(name);
  const verified = babalawo.verification_status === 'approved';
  const online = !!babalawo.is_active;

  const requireAuth = (open: () => void) => () => (user ? open() : navigate('/auth?tab=signin'));

  const babalawoForModal = {
    id: babalawo.id,
    full_name: name,
    avatar_url: babalawo.avatar_url,
    title: 'Ifá priest',
    specialties: Array.isArray(babalawo.specialties) ? babalawo.specialties : [],
    rating: babalawo.rating ? Number(babalawo.rating) : 5,
    reviews: babalawo.total_sessions ?? 0,
    verified,
    nextAvailable: 'Flexible',
    hourly_rate: fee,
    price: `₦${fee.toLocaleString()}/session`,
  };

  const facts = [
    babalawo.experience_years ? { k: 'Experience', v: `${babalawo.experience_years} years` } : null,
    { k: 'Sessions', v: String(babalawo.total_sessions || 0) },
    babalawo.languages?.length ? { k: 'Languages', v: babalawo.languages.join(', ') } : null,
    babalawo.timezone ? { k: 'Time zone', v: babalawo.timezone.replace('_', ' ') } : null,
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <PageShell>
      {/* Hero band */}
      <section className="relative overflow-hidden text-white" style={{ backgroundColor: color }}>
        <div className="wrap grid items-end gap-8 py-10 md:grid-cols-[300px_1fr] md:py-16">
          <PortraitCard
            name=""
            imageUrl={babalawo.avatar_url}
            color="rgba(0,0,0,.18)"
            className="mx-auto w-[220px] md:mx-0 md:h-[380px] md:w-[300px]"
            tilt="left"
          />
          <div>
            <Eyebrow className="text-white/80">{verified ? 'Verified Babalawo' : 'Babalawo'}</Eyebrow>
            <h1 className="mt-3 font-display text-[clamp(44px,7vw,104px)] font-extrabold leading-[.9] tracking-[-0.045em]">
              {name}
              {verified && <BadgeCheck className="ml-3 inline h-[0.5em] w-[0.5em] align-baseline text-leaf" aria-label="Verified" />}
            </h1>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/90 px-3 py-1.5 text-sm font-bold text-ink">
                <Star className="h-4 w-4 fill-sun text-sun" aria-hidden="true" />
                {Number(babalawo.rating || 5).toFixed(1)} · {babalawo.total_sessions || 0} sessions
              </span>
              {babalawo.languages?.slice(0, 3).map((l) => (
                <span key={l} className="rounded-pill bg-white/90 px-3 py-1.5 text-sm font-bold text-ink">{l}</span>
              ))}
              {online && (
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-ink px-3 py-1.5 text-sm font-bold">
                  <span className="h-2 w-2 rounded-full bg-leaf" /> Available now
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="wrap grid gap-10 py-12 lg:grid-cols-[1fr_380px] lg:py-16">
        <div className="min-w-0 space-y-12">
          {babalawo.bio && (
            <section>
              <Eyebrow className="text-camwood">About</Eyebrow>
              <p className="mt-3 max-w-[62ch] whitespace-pre-line text-lg leading-relaxed">{babalawo.bio}</p>
            </section>
          )}

          {babalawo.specialties && babalawo.specialties.length > 0 && (
            <section>
              <Eyebrow className="text-camwood">Specialties</Eyebrow>
              <div className="mt-4 flex flex-wrap gap-2">
                {babalawo.specialties.map((s) => (
                  <span key={s} className="rounded-pill border-2 border-ink px-4 py-2 text-sm font-bold">{s}</span>
                ))}
              </div>
            </section>
          )}

          <section>
            <Eyebrow className="text-camwood">At a glance</Eyebrow>
            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-4">
              {facts.map((f) => (
                <div key={f.k} className="bg-paper p-4">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{f.k}</dt>
                  <dd className="m-0 mt-1 font-display text-xl font-extrabold">{f.v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <Eyebrow className="text-camwood">How a session works</Eyebrow>
            <ul className="mt-4 grid list-none gap-3.5 p-0">
              {[
                'Pick a time and pay. Your Google Meet link arrives once payment clears.',
                'Join from your phone or laptop. No app to install.',
                `${name.split(' ').slice(0, 2).join(' ')} approves your written notes before they reach you.`,
              ].map((t, i) => (
                <li key={t} className="grid grid-cols-[30px_1fr] items-start gap-3">
                  <TickDot>{i + 1}</TickDot>
                  <span className="pt-1">{t}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Booking card */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <StickerPanel className="p-6">
            <Eyebrow className="text-muted-foreground">Consultation fee</Eyebrow>
            <p className="mt-2 font-display text-[44px] font-extrabold leading-none tracking-[-0.03em]">
              ₦{fee.toLocaleString()}
            </p>
            <ul className="mt-5 space-y-2.5 text-[15px]">
              <li className="flex items-center gap-2.5"><Video className="h-4 w-4 text-green-700" />One-to-one on Google Meet</li>
              <li className="flex items-center gap-2.5"><Clock className="h-4 w-4 text-green-700" />Pick a time that suits you</li>
              <li className="flex items-center gap-2.5"><Globe className="h-4 w-4 text-green-700" />Notes you can keep</li>
            </ul>
            <div className="mt-6 grid gap-2.5">
              <Button variant="sun" size="lg" onClick={requireAuth(() => setShowBookingModal(true))}>
                Book a session
              </Button>
              {online && (
                <Button variant="outline" size="lg" onClick={requireAuth(() => setShowInstantModal(true))}>
                  <Zap /> Consult now
                </Button>
              )}
            </div>
          </StickerPanel>
        </aside>
      </div>

      <BookSessionModal open={showBookingModal} onOpenChange={setShowBookingModal} babalawo={babalawoForModal} />
      <InstantConsultationModal open={showInstantModal} onOpenChange={setShowInstantModal} babalawo={babalawoForModal} />
    </PageShell>
  );
};

export default BabalawoProfile;
