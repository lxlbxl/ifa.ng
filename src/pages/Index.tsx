
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import FeaturedBabalawos from "@/components/FeaturedBabalawos";
import OnlineBabalawos from "@/components/OnlineBabalawos";
import TrustBadges from "@/components/TrustBadges";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <HeroSection />
      <HowItWorks />
      <OnlineBabalawos />
      <FeaturedBabalawos />
      <TrustBadges />
      <Footer />
    </div>
  );
};

export default Index;
