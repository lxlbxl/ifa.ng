import React, { useState, useEffect } from "react";
import BabalawoDashboardSidebar from "@/components/dashboard/babalawo/BabalawoDashboardSidebar";
import BabalawoDashboardOverview from "@/components/dashboard/babalawo/BabalawoDashboardOverview";
import AuthenticatedHeader from "@/components/AuthenticatedHeader";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

import BabalawoConsultationsPanel from "@/components/dashboard/babalawo/BabalawoConsultationPanel";
import BabalawoProfileSettings from "@/components/dashboard/babalawo/BabalawoProfileSettings";

import BabalawoEarnings from "@/components/dashboard/babalawo/BabalawoEarnings";
import WithdrawalRequestModal from "@/components/dashboard/babalawo/WithdrawalRequestModal";

import Settings from "@/components/dashboard/user/Settings";
import Support from "@/components/dashboard/user/Support";

const SECTION_MAP: { [key: string]: React.ReactNode } = {
  dashboard: <BabalawoDashboardOverview />,
  consultations: <BabalawoConsultationsPanel />,
  earnings: <BabalawoEarnings />,
  profile: <BabalawoProfileSettings />,
  settings: <Settings />,
  support: <Support />,
};

const BabalawoDashboard = () => {
  // Force type to string, not string | number, for setActiveSection
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);

  useEffect(() => {
    const openWithdrawalModalHandler = () => setWithdrawalModalOpen(true);
    window.addEventListener("openWithdrawalModal", openWithdrawalModalHandler);
    return () => {
      window.removeEventListener("openWithdrawalModal", openWithdrawalModalHandler);
    };
  }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3eafd] to-[#e8ecfa] flex flex-col">
      <AuthenticatedHeader />
      {/* Mobile Hamburger Button */}
      <div className="md:hidden flex items-center justify-between px-4 py-3">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <button
              className="p-2 rounded-md text-violet-700 border border-violet-100 shadow bg-white"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
              type="button"
            >
              <Menu size={28} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 max-w-xs">
            <BabalawoDashboardSidebar
              activeSection={activeSection}
              onSectionChange={(section) => {
                setActiveSection(section);
                setDrawerOpen(false);
              }}
            />
          </SheetContent>
        </Sheet>
        <span className="font-extrabold text-lg text-violet-700 tracking-wider">IFA.ng</span>
      </div>
      <div className="flex flex-1 min-h-0 w-full">
        <div className="hidden md:block">
          <BabalawoDashboardSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        </div>
        {/* Main content */}
        <main className="flex-1 min-h-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            {/* Build error fix: Ensure activeSection is a string for the sidebar */}
            {SECTION_MAP[`${activeSection}`]}
          </div>
        </main>
      </div>
      {/* Footer removed */}
      {/* Withdrawal Request Modal */}
      {withdrawalModalOpen && (
        <WithdrawalRequestModal
          open={withdrawalModalOpen}
          onOpenChange={setWithdrawalModalOpen}
          onSuccess={() => {
            // Optionally refetch data or show toast
          }}
        />
      )}
    </div>
  );
};
export default BabalawoDashboard;
