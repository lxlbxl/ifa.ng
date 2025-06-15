
import React, { useState } from "react";
import AdminSidebar from "@/components/dashboard/admin/AdminSidebar";
import AdminHeader from "@/components/dashboard/admin/AdminHeader";
import AdminSummaryCards from "@/components/dashboard/admin/AdminSummaryCards";
import AdminSectionTabs from "@/components/dashboard/admin/AdminSectionTabs";
import AdminAnalyticsPanels from "@/components/dashboard/admin/AdminAnalyticsPanels";
import AdminSidebarMobile from "@/components/dashboard/admin/AdminSidebarMobile";
import { Menu } from "lucide-react";
import { useState } from "react";

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState<
    'overview' | 'users' | 'babalawos' | 'finance' | 'settings'
  >('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f6f8fc] to-[#e9edfb] flex font-poppins relative">
      {/* Sidebar for Desktop */}
      <AdminSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      {/* Sidebar for Mobile */}
      <AdminSidebarMobile
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <main className="flex-1 flex flex-col px-2 sm:px-4 py-6 max-w-[1440px] mx-auto w-full">
        {/* Hamburger button (mobile only) */}
        <div className="md:hidden flex items-center mb-3">
          <button
            className="p-2 rounded-md bg-white shadow border border-gray-200 hover:bg-indigo-100 focus:outline-none"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="w-6 h-6 text-indigo-600" />
          </button>
        </div>
        <AdminHeader />
        <div className="w-full">
          <AdminSummaryCards />
        </div>
        <AdminSectionTabs
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <AdminAnalyticsPanels />
      </main>
    </div>
  );
};

export default AdminDashboard;
