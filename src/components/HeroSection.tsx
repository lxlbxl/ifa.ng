import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Eyebrow, SoundWave } from '@/components/brand';
import InstallButton from '@/components/pwa/InstallButton';

/**
 * Full-bleed chant hero. Plays the edited chant loop muted, with a tap-to-hear
 * chip. Wide screens get the 16:9 cut (singers on the right, headline space on
 * the left); tall screens get the 9:16 cut. Sources live in public/hero/ and
 * are rebuilt with scripts/hero-video/ (see its README).
 *
 * Reduced motion or Data Saver: the matching poster only, no video.
 */
type Variant = 'desktop' | 'mobile';

const SOURCES: Record<Variant, { webm: string; mp4: string; poster: string; position: string }> = {
  desktop: {
    webm: '/hero/hero-chant-desktop.webm',
    mp4: '/hero/hero-chant-desktop.mp4',
    poster: '/hero/hero-chant-desktop-poster.jpg',
    position: '72% 20%',
  },
  mobile: {
    webm: '/hero/hero-chant-mobile.webm',
    mp4: '/hero/hero-chant-mobile.mp4',
    poster: '/hero/hero-chant-mobile-poster.jpg',
    position: '50% 32%',
  },
};

const WIDE_QUERY = '(min-aspect-ratio: 1/1)';

const pickVariant = (): Variant =>
  typeof window !== 'undefined' && window.matchMedia(WIDE_QUERY).matches ? 'desktop' : 'mobile';

const HeroSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [variant, setVariant] = useState<Variant>(pickVariant);
  const [videoAllowed, setVideoAllowed] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    setVideoAllowed(!reduced && !saveData);

    const wide = window.matchMedia(WIDE_QUERY);
    const onChange = () => setVariant(pickVariant());
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, []);

  // Pause while the hero is off screen, so the chant doesn't keep playing (or
  // burning battery) while people read the rest of the page.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !videoAllowed || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([entry]) => {
      const v = videoRef.current;
      if (!v) return;
      if (entry.isIntersecting) void v.play().catch(() => undefined);
      else v.pause();
    }, { threshold: 0.15 });
    io.observe(section);
    return () => io.disconnect();
  }, [videoAllowed, variant]);

  const src = SOURCES[variant];

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.paused) void v.play().catch(() => undefined);
  };

  return (
    <section
      ref={sectionRef}
      id="top"
      aria-label="Featured chant"
      className="relative isolate h-[max(820px,100svh)] overflow-hidden bg-[#fdfcf8] text-ink [@media(min-aspect-ratio:1/1)]:h-[clamp(600px,92vh,900px)]"
    >
      {/* Tall screens: the video fills the top 56% and fades into cream above the text. Wide screens: full bleed. */}
      <div className="absolute inset-x-0 top-0 -z-20 h-[56%] [mask-image:linear-gradient(180deg,#000_78%,transparent)] [@media(min-aspect-ratio:1/1)]:h-full [@media(min-aspect-ratio:1/1)]:[mask-image:none]">
        <div
          role="img"
          aria-label="Women in white with ìlẹ̀kẹ̀ beads singing an Ifá chant"
          className={`absolute inset-0 bg-[#fdfcf8] bg-cover bg-no-repeat ${videoAllowed ? '' : 'animate-drift'}`}
          style={{ backgroundImage: `url(${src.poster})`, backgroundPosition: src.position }}
        />
        {videoAllowed && (
          <video
            key={variant}
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: src.position }}
            poster={src.poster}
            autoPlay
            muted={muted}
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          >
            <source src={src.webm} type="video/webm" />
            <source src={src.mp4} type="video/mp4" />
          </video>
        )}
      </div>
      {/* Cream wash: keeps the header and the ink headline readable over the white video. */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(253,252,248,.7)_0%,rgba(253,252,248,0)_18%)] [@media(min-aspect-ratio:1/1)]:bg-[linear-gradient(180deg,rgba(253,252,248,.7)_0%,rgba(253,252,248,0)_22%,rgba(253,252,248,0)_50%,rgba(253,252,248,.85)_80%,rgba(253,252,248,.97)_100%)]" />

      {/* Now playing chip */}
      <button
        type="button"
        onClick={videoAllowed ? toggleSound : undefined}
        aria-label={videoAllowed ? (muted ? 'Play chant with sound' : 'Mute chant') : undefined}
        tabIndex={videoAllowed ? 0 : -1}
        className="absolute left-1/2 top-[calc(56%-118px)] flex -translate-x-1/2 items-center gap-3.5 whitespace-nowrap rounded-pill border border-white/25 bg-ink/70 py-2.5 pl-2.5 pr-5 text-[13px] font-semibold text-white backdrop-blur-md sm:text-sm [@media(min-aspect-ratio:1/1)]:top-1/2 [@media(min-aspect-ratio:1/1)]:-translate-y-1/2"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-sun text-ink">
          {videoAllowed && !muted ? <Volume2 className="h-[18px] w-[18px]" /> : videoAllowed ? <VolumeX className="h-[18px] w-[18px]" /> : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" /></svg>
          )}
        </span>
        <span className="text-left">
          Ìwúre · morning prayer
          <small className="block text-xs font-medium opacity-75">
            {videoAllowed ? (muted ? 'Tap to hear the chant' : 'Playing with sound') : 'Chant from one of our Babalawos'}
          </small>
        </span>
        <SoundWave />
      </button>

      <div className="absolute inset-x-0 bottom-0 pb-[clamp(36px,6vh,72px)]">
        <div className="wrap">
          <Eyebrow className="text-green">Ifá consultation, online</Eyebrow>
          <h1 className="mt-3.5 max-w-[12ch] font-display text-display-xl font-extrabold">
            Hear Ifá <span className="[box-shadow:inset_0_-0.2em_0_var(--sun)]">speak.</span>
          </h1>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <p className="m-0 max-w-[480px] text-base text-ink/75 sm:text-lg">
              Sit with a verified Babalawo over Google Meet, wherever you are. Every session ends with written notes you can keep.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="sun" size="lg">
                <Link to="/search">Meet the Babalawos →</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="hidden sm:inline-flex">
                <a href="#sessions">How sessions work</a>
              </Button>
              <InstallButton variant="hero" label="Download the app" buttonVariant="outline" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
