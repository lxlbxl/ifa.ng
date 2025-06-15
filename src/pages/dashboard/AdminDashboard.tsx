
import React, { useState } from "react";
import AdminSidebar from "@/components/dashboard/admin/AdminSidebar";
import AdminHeader from "@/components/dashboard/admin/AdminHeader";
import AdminSummaryCards from "@/components/dashboard/admin/AdminSummaryCards";
import AdminSectionTabs from "@/components/dashboard/admin/AdminSectionTabs";
import AdminAnalyticsPanels from "@/components/dashboard/admin/AdminAnalyticsPanels";

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState<'overview' | 'users' | 'babalawos'>('overview');

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f6f8fc] to-[#e9edfb] flex font-poppins">
      {/* Sidebar */}
      <AdminSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col px-6 py-8 max-w-[1440px] mx-auto">
        <AdminHeader />
        <AdminSummaryCards />
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
