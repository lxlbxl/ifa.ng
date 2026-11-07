
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
import { Menu } from "lucide-react";
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

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-indigo-50/30 to-purple-50/20 flex font-poppins relative">
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

      <main className="flex-1 flex flex-col px-2 sm:px-4 lg:px-6 py-4 sm:py-6 pb-20 md:pb-6 max-w-[1440px] mx-auto w-full overflow-hidden">
        {/* Hamburger button (mobile only) */}
        <div className="lg:hidden flex items-center mb-3 animate-fade-in">
          <button
            className="p-2 rounded-xl bg-white shadow-md border border-gray-200 hover:bg-primary/10 hover:border-primary/30 focus:outline-none transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="w-6 h-6 text-primary" />
          </button>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="animate-fade-in-down">
            <AdminHeader />
          </div>
          <div className="w-full animate-fade-in-up">
            <AdminSummaryCards />
          </div>
          <div className="animate-fade-in" style={{animationDelay: '100ms'}}>
            <AdminSectionTabs
              activeSection={activeSection}
              onSectionChange={setActiveSection}
            />
          </div>
          <div className="w-full overflow-hidden animate-fade-in-up" style={{animationDelay: '200ms'}}>
            {renderActiveSection()}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation - only visible on mobile for logged in admins */}
      <MobileBottomNav userType="admin" />
    </div>
  );
};

export default AdminDashboard;
