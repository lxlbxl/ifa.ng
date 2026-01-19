
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import StatsSection from "@/components/StatsSection";
import HowItWorks from "@/components/HowItWorks";
import FeaturedBabalawos from "@/components/FeaturedBabalawos";
import OnlineBabalawos from "@/components/OnlineBabalawos";
import TestimonialsSection from "@/components/TestimonialsSection";
import TrustBadges from "@/components/TrustBadges";
import FAQSection from "@/components/FAQSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <HeroSection />
      <StatsSection />
      <HowItWorks />
      <OnlineBabalawos />
      <FeaturedBabalawos />
      <TestimonialsSection />
      <TrustBadges />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
