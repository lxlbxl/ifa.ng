import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Eyebrow, SoundWave } from '@/components/brand';
import InstallButton from '@/components/pwa/InstallButton';

/**
 * Full-bleed chant hero. Plays VITE_HERO_VIDEO_URL (an MP4 the team owns) muted
 * and looped, with the poster drifting behind it while it loads. Without a
 * video it shows the poster with a slow zoom.
 */
const HERO_VIDEO = import.meta.env.VITE_HERO_VIDEO_URL as string | undefined;
const POSTER = '/brand/hero-chant-poster.jpg';

const HeroSection = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
  }, []);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.paused) void v.play();
  };

  return (
    <section
      id="top"
      aria-label="Featured chant"
      className="relative isolate h-[clamp(600px,92vh,900px)] overflow-hidden bg-ink text-white"
    >
      <div
        role="img"
        aria-label="A Babalawo in white lace agbada and ìlẹ̀kẹ̀ beads chanting"
        className="absolute inset-0 -z-20 animate-drift bg-cover bg-no-repeat [background-position:center_30%]"
        style={{ backgroundImage: `url(${POSTER})` }}
      />
      {HERO_VIDEO && !reduced && (
        <video
          ref={videoRef}
          className="absolute inset-0 -z-20 h-full w-full object-cover [object-position:center_30%]"
          src={HERO_VIDEO}
          poster={POSTER}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      )}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(10,14,9,.55)_0%,rgba(10,14,9,.05)_28%,rgba(10,14,9,.25)_55%,rgba(10,14,9,.92)_100%)]" />

      {/* Now playing chip */}
      <button
        type="button"
        onClick={HERO_VIDEO ? toggleSound : undefined}
        aria-label={HERO_VIDEO ? (muted ? 'Play chant with sound' : 'Mute chant') : undefined}
        tabIndex={HERO_VIDEO ? 0 : -1}
        className="absolute left-1/2 top-[124px] flex -translate-x-1/2 sm:-translate-y-1/2 items-center gap-3.5 whitespace-nowrap rounded-pill border border-white/25 bg-ink/70 py-2.5 pl-2.5 pr-5 text-[13px] font-semibold text-white backdrop-blur-md sm:top-1/2 sm:text-sm"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-sun text-ink">
          {HERO_VIDEO && !muted ? <Volume2 className="h-[18px] w-[18px]" /> : HERO_VIDEO ? <VolumeX className="h-[18px] w-[18px]" /> : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" /></svg>
          )}
        </span>
        <span className="text-left">
          Ìwúre · morning prayer
          <small className="block text-xs font-medium opacity-75">
            {HERO_VIDEO ? (muted ? 'Tap to hear the chant' : 'Playing with sound') : 'Chant from one of our Babalawos'}
          </small>
        </span>
        <SoundWave />
      </button>

      <div className="absolute inset-x-0 bottom-0 pb-[clamp(36px,6vh,72px)]">
        <div className="wrap">
          <Eyebrow className="text-leaf">Ifá consultation, online</Eyebrow>
          <h1 className="mt-3.5 max-w-[12ch] font-display text-display-xl font-extrabold">
            Hear Ifá <span className="text-sun">speak.</span>
          </h1>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <p className="m-0 max-w-[480px] text-base text-[#ece6d6] sm:text-lg">
              Sit with a verified Babalawo over Google Meet, wherever you are. Every session ends with written notes you can keep.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="sun" size="lg">
                <Link to="/search">Meet the Babalawos →</Link>
              </Button>
              <Button asChild variant="glass" size="lg" className="hidden sm:inline-flex">
                <a href="#sessions">How sessions work</a>
              </Button>
              <InstallButton variant="hero" label="Download the app" buttonVariant="glass" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
