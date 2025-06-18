
import React, { useState } from "react";
import AdminSidebar from "@/components/dashboard/admin/AdminSidebar";
import AdminHeader from "@/components/dashboard/admin/AdminHeader";
import AdminSummaryCards from "@/components/dashboard/admin/AdminSummaryCards";
import AdminSectionTabs from "@/components/dashboard/admin/AdminSectionTabs";
import AdminAnalyticsPanels from "@/components/dashboard/admin/AdminAnalyticsPanels";
import AdminSidebarMobile from "@/components/dashboard/admin/AdminSidebarMobile";
import AdminTransactionHistory from "@/components/dashboard/admin/AdminTransactionHistory";
import AdminWalletManagement from "@/components/dashboard/admin/AdminWalletManagement";
import { Menu } from "lucide-react";

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState<
    'overview' | 'users' | 'babalawos' | 'finance' | 'transactions' | 'wallet-management' | 'settings'
  >('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'transactions':
        return <AdminTransactionHistory />;
      case 'wallet-management':
        return <AdminWalletManagement />;
      default:
        return <AdminAnalyticsPanels />;
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f6f8fc] to-[#e9edfb] flex font-poppins relative">
      {/* Sidebar for Desktop */}
      <div className="hidden lg:block">
        <AdminSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
      </div>

      {/* Sidebar for Mobile */}
      <AdminSidebarMobile
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <main className="flex-1 flex flex-col px-2 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-[1440px] mx-auto w-full overflow-hidden">
        {/* Hamburger button (mobile only) */}
        <div className="lg:hidden flex items-center mb-3">
          <button
            className="p-2 rounded-md bg-white shadow border border-gray-200 hover:bg-indigo-100 focus:outline-none"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="w-6 h-6 text-indigo-600" />
          </button>
        </div>
        
        <div className="space-y-4 sm:space-y-6">
          <AdminHeader />
          <div className="w-full">
            <AdminSummaryCards />
          </div>
          <AdminSectionTabs
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
          <div className="w-full overflow-hidden">
            {renderActiveSection()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
