
import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ADMIN_TABS, resolveTab } from "@/lib/dashboardLinks";
import AdminSidebar from "@/components/dashboard/admin/AdminSidebar";
import AdminHeader from "@/components/dashboard/admin/AdminHeader";
import AdminInsights from "@/components/dashboard/admin/insights/AdminInsights";
import { hasInsights } from "@/components/dashboard/admin/insights/sectionInsights";
import type { InsightPeriod } from "@/components/brand";
import AdminSectionTabs from "@/components/dashboard/admin/AdminSectionTabs";
import AdminAnalyticsPanels from "@/components/dashboard/admin/AdminAnalyticsPanels";
import AdminSidebarMobile from "@/components/dashboard/admin/AdminSidebarMobile";
import AdminTransactionHistory from "@/components/dashboard/admin/AdminTransactionHistory";
import AdminWalletManagement from "@/components/dashboard/admin/AdminWalletManagement";
import UserManagement from "@/components/dashboard/admin/UserManagement";
import BabalawoManagement from "@/components/dashboard/admin/BabalawoManagement";
import BabalawoApplications from "@/components/dashboard/admin/BabalawoApplications";
import PaymentsFinancePanel from "@/components/dashboard/admin/PaymentsFinancePanel";
import AdminSettingsPanel from "@/components/dashboard/admin/AdminSettingsPanel";
import AdminWithdrawalManagement from "@/components/dashboard/admin/AdminWithdrawalManagement"; // Import the new component
import AdminBookings from "@/components/dashboard/admin/AdminBookings";
import AdminDisputes from "@/components/dashboard/admin/AdminDisputes";
import AdminActivityLog from "@/components/dashboard/admin/AdminActivityLog";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { adminSections, type AdminSection } from "@/components/dashboard/admin/adminSections";
import AdminEbo from "@/components/dashboard/admin/AdminEbo";
import AdminReviews from "@/components/dashboard/admin/AdminReviews";
import AdminPrivacy from "@/components/dashboard/admin/AdminPrivacy";
import { MobileBottomNav } from "@/components/shared/MobileBottomNav";

const AdminDashboard = () => {
  // The section lives in the URL (?section= or ?tab=), so the phone bottom bar, notifications,
  // refresh and the back button all land on the right screen.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = resolveTab(ADMIN_TABS, searchParams.get('section') ?? searchParams.get('tab'), 'overview') as AdminSection;
  const setActiveSection = (section: AdminSection) => setSearchParams(section === 'overview' ? {} : { section });
  const [mobileOpen, setMobileOpen] = useState(false);
  // One period for every admin page, so switching pages keeps the comparison the same.
  const [insightDays, setInsightDays] = useState<InsightPeriod>(30);
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
      case 'applications':
        return <BabalawoApplications />;
      case 'bookings':
        return <AdminBookings />;
      case 'disputes':
        return <AdminDisputes />;
      case 'ebo':
        return <AdminEbo />;
      case 'reviews':
        return <AdminReviews />;
      case 'activity':
        return <AdminActivityLog />;
      case 'privacy':
        return <AdminPrivacy />;
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
          <AdminSectionTabs activeSection={activeSection} onSectionChange={setActiveSection} />
          {hasInsights(activeSection) && (
            <AdminInsights section={activeSection} days={insightDays} onDaysChange={setInsightDays} />
          )}
          <div className="w-full min-w-0">{renderActiveSection()}</div>
        </div>
      </main>

      {/* Mobile Bottom Navigation - only visible on mobile for logged in admins */}
      <MobileBottomNav userType="admin" />
    </div>
  );
};

export default AdminDashboard;
