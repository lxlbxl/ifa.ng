
import React from "react";
import BabalawoDashboardSidebar from "@/components/dashboard/babalawo/BabalawoDashboardSidebar";
import BabalawoDashboardOverview from "@/components/dashboard/babalawo/BabalawoDashboardOverview";
import AuthenticatedHeader from "@/components/AuthenticatedHeader";
// Removed Footer import!

import BabalawoConsultationsPanel from "@/components/dashboard/babalawo/BabalawoConsultationPanel";
import BabalawoProfileSettings from "@/components/dashboard/babalawo/BabalawoProfileSettings";

// Dummy components for demonstration (replace with actual when ready)
const Earnings = () => (
  <div className="p-10 bg-white rounded-2xl shadow-lg">
    <h2 className="text-2xl font-bold mb-2 text-violet-700">Earnings</h2>
    <p>Track your completed sessions and income here.</p>
  </div>
);

const Settings = () => (
  <div className="p-10 bg-white rounded-2xl shadow-lg">
    <h2 className="text-2xl font-bold mb-2 text-violet-700">Settings</h2>
    <p>Change your account details and preferences.</p>
  </div>
);

const Support = () => (
  <div className="p-10 bg-white rounded-2xl shadow-lg">
    <h2 className="text-2xl font-bold mb-2 text-violet-700">Support</h2>
    <p>Get support. We are here to help!</p>
  </div>
);

const SECTION_MAP: { [key: string]: React.ReactNode } = {
  dashboard: <BabalawoDashboardOverview />,
  consultations: <BabalawoConsultationsPanel />,
  earnings: <Earnings />,
  profile: <BabalawoProfileSettings />,
  settings: <Settings />,
  support: <Support />,
};

const BabalawoDashboard = () => {
  const [activeSection, setActiveSection] = React.useState<keyof typeof SECTION_MAP>("dashboard");

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3eafd] to-[#e8ecfa] flex flex-col">
      <AuthenticatedHeader />
      <div className="flex flex-1 min-h-0 w-full">
        <div className="hidden md:block">
          <BabalawoDashboardSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        </div>
        
        {/* Mobile sidebar button (optional, for future) */}
        
        <main className="flex-1 min-h-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            {SECTION_MAP[activeSection]}
          </div>
        </main>
      </div>
      {/* Footer removed */}
    </div>
  );
};
export default BabalawoDashboard;
