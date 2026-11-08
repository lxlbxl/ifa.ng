import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import FeaturedBabalawos from '@/components/FeaturedBabalawos';
import SessionsSection from '@/components/SessionsSection';
import HowItWorks from '@/components/HowItWorks';
import DailyVerse from '@/components/DailyVerse';
import FAQSection from '@/components/FAQSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import { OduTicker } from '@/components/brand';

/** Homepage, following the approved VeeFriends-style preview. */
const Index = () => (
  <div className="min-h-screen bg-cloth">
    <Header variant="clear" />
    <main>
      <HeroSection />
      <FeaturedBabalawos />
      <OduTicker />
      <SessionsSection />
      <HowItWorks />
      <DailyVerse />
      <FAQSection />
      <CTASection />
    </main>
    <Footer />
  </div>
);

export default Index;
