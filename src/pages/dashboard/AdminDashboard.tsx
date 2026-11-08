
import React, { useState } from "react";
import AdminSidebar from "@/components/dashboard/admin/AdminSidebar";
import AdminHeader from "@/components/dashboard/admin/AdminHeader";
import AdminSummaryCards from "@/components/dashboard/admin/AdminSummaryCards";
import AdminSectionTabs from "@/components/dashboard/admin/AdminSectionTabs";
import AdminAnalyticsPanels from "@/components/dashboard/admin/AdminAnalyticsPanels";
import AdminSidebarMobile from "@/components/dashboard/admin/AdminSidebarMobile";
import AdminTransactionHistory from "@/components/dashboard/admin/AdminTransactionHistory";
import AdminWalletManagement from "@/components/dashboard/admin/AdminWalletManagement";
import UserManagement from "@/components/dashboard/admin/UserManagement";
import BabalawoManagement from "@/components/dashboard/admin/BabalawoManagement";
import PaymentsFinancePanel from "@/components/dashboard/admin/PaymentsFinancePanel";
import AdminSettingsPanel from "@/components/dashboard/admin/AdminSettingsPanel";
import AdminWithdrawalManagement from "@/components/dashboard/admin/AdminWithdrawalManagement"; // Import the new component
import AdminBookings from "@/components/dashboard/admin/AdminBookings";
import AdminDisputes from "@/components/dashboard/admin/AdminDisputes";
import AdminActivityLog from "@/components/dashboard/admin/AdminActivityLog";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { adminSections } from "@/components/dashboard/admin/adminSections";
import { MobileBottomNav } from "@/components/shared/MobileBottomNav";

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState<
    'overview' | 'users' | 'babalawos' | 'bookings' | 'disputes' | 'finance' | 'transactions' | 'wallet-management' | 'settings' | 'withdrawal-management' | 'activity' // Add new section type
  >('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAdmin, loading } = useAuth();
  if (!loading && !isAdmin) return <Navigate to="/dashboard" replace />;

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'overview':
        return <AdminAnalyticsPanels />;
      case 'users':
        return <UserManagement />;
      case 'babalawos':
        return <BabalawoManagement />;
      case 'bookings':
        return <AdminBookings />;
      case 'disputes':
        return <AdminDisputes />;
      case 'activity':
        return <AdminActivityLog />;
      case 'finance':
        return <PaymentsFinancePanel />;
      case 'transactions':
        return <AdminTransactionHistory />;
      case 'wallet-management':
        return <AdminWalletManagement />;
      case 'withdrawal-management': // Add new case for withdrawal management
        return <AdminWithdrawalManagement />;
      case 'settings':
        return <AdminSettingsPanel />;
      default:
        return <AdminAnalyticsPanels />;
    }
  };

  const sectionTitle = adminSections.find((s) => s.section === activeSection)?.label ?? 'Overview';

  return (
    <div className="relative flex min-h-screen w-full bg-cloth">
      <div className="hidden lg:block">
        <AdminSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>

      <AdminSidebarMobile
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <main className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col px-4 pb-24 pt-6 md:pb-10 lg:px-10 lg:pt-10">
        <div className="space-y-6">
          <AdminHeader title={sectionTitle} onOpenMenu={() => setMobileOpen(true)} />
          {activeSection === 'overview' && <AdminSummaryCards />}
          <AdminSectionTabs activeSection={activeSection} onSectionChange={setActiveSection} />
          <div className="w-full min-w-0">{renderActiveSection()}</div>
        </div>
      </main>

      {/* Mobile Bottom Navigation - only visible on mobile for logged in admins */}
      <MobileBottomNav userType="admin" />
    </div>
  );
};

export default AdminDashboard;
