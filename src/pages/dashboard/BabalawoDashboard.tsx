import React from "react";
import BabalawoDashboardSidebar from "@/components/dashboard/babalawo/BabalawoDashboardSidebar";
import BabalawoDashboardOverview from "@/components/dashboard/babalawo/BabalawoDashboardOverview";
import AuthenticatedHeader from "@/components/AuthenticatedHeader";
import Footer from "@/components/Footer";

const BabalawoDashboard = () => {
  // Sidebar State (if you want to allow switching sections in future, keep for extensibility)
  const [activeSection] = React.useState<"dashboard">("dashboard");

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3eafd] to-[#e8ecfa] flex flex-col">
      <AuthenticatedHeader />
      <div className="flex flex-1 min-h-0 w-full">
        <div className="hidden md:block">
          <BabalawoDashboardSidebar activeSection={activeSection} />
        </div>
        <main className="flex-1 min-h-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <BabalawoDashboardOverview />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default BabalawoDashboard;
