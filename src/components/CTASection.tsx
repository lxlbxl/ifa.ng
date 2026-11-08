import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/brand';

/** Coral "For Babalawos" recruitment band. */
const CTASection = () => (
  <section id="join" className="band">
    <div className="wrap">
      <div className="flex flex-wrap items-center justify-between gap-8 rounded-[36px] bg-coral p-[clamp(30px,5vw,64px)] text-white">
        <div>
          <Eyebrow className="text-[#ffe3a3]">For Babalawos</Eyebrow>
          <h2 className="mt-3 max-w-[16ch] font-display text-display-md font-extrabold">Consult the world from your ilé.</h2>
          <p className="m-0 mt-3.5 max-w-[46ch] text-[#fde3da]">
            Set your fee and hours. Sessions run on Google Meet, and notes are drafted for you to approve.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/auth?tab=signup&role=babalawo">Apply to join →</Link>
        </Button>
      </div>
    </div>
  </section>
);

export default CTASection;
