import React, { useState, useEffect } from "react";
import BabalawoDashboardSidebar from "@/components/dashboard/babalawo/BabalawoDashboardSidebar";
import BabalawoDashboardOverview from "@/components/dashboard/babalawo/BabalawoDashboardOverview";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Bell, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import BabalawoSessions from "@/components/dashboard/babalawo/BabalawoSessions";
import BabalawoAvailabilityManager from "@/components/dashboard/babalawo/BabalawoAvailabilityManager";
import BabalawoPricing from "@/components/dashboard/babalawo/BabalawoPricing";
import BabalawoPayments from "@/components/dashboard/babalawo/BabalawoPayments";
import NetworkStatusBar from "@/components/pwa/NetworkStatusBar";
import InstallButton from "@/components/pwa/InstallButton";
import NotificationSettings from "@/components/pwa/NotificationSettings";
import { useSearchParams } from "react-router-dom";
import BabalawoProfileSettings from "@/components/dashboard/babalawo/BabalawoProfileSettings";
import BabalawoEarnings from "@/components/dashboard/babalawo/BabalawoEarnings";
import BabalawoReviews from "@/components/dashboard/babalawo/BabalawoReviews";
import WithdrawalRequestModal from "@/components/dashboard/babalawo/WithdrawalRequestModal";
import BankDetailsModal from "@/components/dashboard/babalawo/BankDetailsModal";
import Settings from "@/components/dashboard/user/Settings";
import Support from "@/components/dashboard/user/Support";
import Notifications from "@/components/dashboard/user/Notifications";
import { MobileBottomNav } from "@/components/shared/MobileBottomNav";

// Create a new Reminders component
const Reminders = () => {
  return (
    <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Clock className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-800">Reminders</h2>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-xl transition-all duration-300 animate-fade-in-up">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-gradient-to-b from-primary to-purple-600 rounded-full"></span>
            Session Reminders
          </h3>
          <p className="text-gray-600 mb-4">
            Set reminders for upcoming sessions to ensure you're prepared and on time.
          </p>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-gray-50 to-purple-50/30 rounded-xl hover:shadow-md transition-all duration-200">
              <div>
                <p className="font-medium">10 minutes before session</p>
                <p className="text-sm text-gray-500">Get ready to join</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-gray-50 to-purple-50/30 rounded-xl hover:shadow-md transition-all duration-200">
              <div>
                <p className="font-medium">30 minutes before session</p>
                <p className="text-sm text-gray-500">Prepare your space</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-gray-50 to-purple-50/30 rounded-xl hover:shadow-md transition-all duration-200">
              <div>
                <p className="font-medium">1 hour before session</p>
                <p className="text-sm text-gray-500">Final preparation</p>
              </div>
              <Switch />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-xl transition-all duration-300 animate-fade-in-up" style={{animationDelay: '100ms'}}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-gradient-to-b from-primary to-purple-600 rounded-full"></span>
            Ritual/Ebo/Etutu Reminders
          </h3>
          <p className="text-gray-600 mb-4">
            Create reminders for rituals or spiritual practices you've prescribed to clients.
          </p>
          <Button className="w-full hover:scale-[1.02] transition-transform duration-200">Add New Reminder</Button>

          <div className="mt-4 space-y-3">
            <div className="p-3 border-2 border-primary/20 rounded-xl hover:shadow-md transition-all duration-200 hover:border-primary/40">
              <div className="flex justify-between">
                <p className="font-medium">Ebo for Client: Adunni O.</p>
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20">Tomorrow</Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">Offering at the river</p>
            </div>
            <div className="p-3 border-2 border-gray-200 rounded-xl hover:shadow-md transition-all duration-200 hover:border-primary/40">
              <div className="flex justify-between">
                <p className="font-medium">Etutu for Client: Michael T.</p>
                <Badge variant="outline">In 3 days</Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">Cleansing ritual</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-xl transition-all duration-300 animate-fade-in-up" style={{animationDelay: '200ms'}}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-gradient-to-b from-orange-500 to-red-500 rounded-full"></span>
            Warning Reminders
          </h3>
          <p className="text-gray-600 mb-4">
            Set reminders for important warnings given to clients.
          </p>
          <Button className="w-full hover:scale-[1.02] transition-transform duration-200">Add New Warning</Button>

          <div className="mt-4 space-y-3">
            <div className="p-3 border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-red-50/30 rounded-xl hover:shadow-md transition-all duration-200">
              <div className="flex justify-between">
                <p className="font-medium">Warning for Client: Fatima A.</p>
                <Badge variant="outline" className="text-orange-700 bg-orange-100 border-orange-300">Important</Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">Avoid traveling by water this month</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SECTION_MAP: { [key: string]: React.ReactNode } = {
  dashboard: <BabalawoDashboardOverview />,
  consultations: <BabalawoSessions />,
  availability: <BabalawoAvailabilityManager />,
  pricing: <BabalawoPricing />,
  payments: <BabalawoPayments />,
  earnings: <BabalawoEarnings />,
  reviews: <BabalawoReviews />,
  notifications: <Notifications />,
  reminders: <Reminders />,
  profile: <BabalawoProfileSettings />,
  settings: (
    <div className="space-y-6">
      <NotificationSettings />
      <Settings />
    </div>
  ),
  support: <Support />,
};

const BabalawoDashboardHeader = ({ activeSection, onSectionChange }: { activeSection: string, onSectionChange: (section: string) => void }) => {
  const { user, userProfile } = useAuth();
  const userName = userProfile?.full_name || user?.email || "Babalawo";
  const userAvatar = userProfile?.avatar_url;
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-gray-200 py-3 px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-sm">
      <div className="flex items-center lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-2 hover:bg-primary/10 transition-colors duration-200">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 animate-slide-in-left">
            <BabalawoDashboardSidebar
              activeSection={activeSection}
              onSectionChange={onSectionChange}
            />
          </SheetContent>
        </Sheet>

        <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          {activeSection.charAt(0).toUpperCase() + activeSection.slice(1) || 'Dashboard'}
        </h1>
      </div>

      <div className="hidden lg:block">
        <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          {activeSection.charAt(0).toUpperCase() + activeSection.slice(1) || 'Dashboard'}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <InstallButton label="Install app" />
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-primary/10 transition-all duration-200 hover:scale-110"
          onClick={() => onSectionChange('notifications')}
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
        </Button>

        <div className="flex items-center gap-3 hover:bg-gray-50 rounded-xl px-2 py-1 transition-colors duration-200">
          <Avatar className="h-8 w-8 border-2 border-primary/20 ring-2 ring-primary/10">
            <AvatarImage src={userAvatar} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white">{userName.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-gray-700 hidden sm:inline-block">{userName}</span>
        </div>
      </div>
    </header>
  );
};

const BabalawoDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  const activeSection = tab && tab in SECTION_MAP ? tab : "dashboard";
  const setActiveSection = (section: string) => setSearchParams(section === "dashboard" ? {} : { tab: section });
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [bankDetailsModalOpen, setBankDetailsModalOpen] = useState(false);

  useEffect(() => {
    const openWithdrawalModalHandler = () => setWithdrawalModalOpen(true);
    const openBankDetailsModalHandler = () => setBankDetailsModalOpen(true);

    window.addEventListener("openWithdrawalModal", openWithdrawalModalHandler);
    window.addEventListener("openBankDetailsModal", openBankDetailsModalHandler);

    return () => {
      window.removeEventListener("openWithdrawalModal", openWithdrawalModalHandler);
      window.removeEventListener("openBankDetailsModal", openBankDetailsModalHandler);
    };
  }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-violet-50 via-purple-50/30 to-indigo-50 flex flex-col font-poppins">
      <div className="sticky top-0 z-40">
        <NetworkStatusBar />
        <BabalawoDashboardHeader
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
      </div>

      <div className="flex flex-1 min-h-0 w-full">
        <div className="hidden lg:block">
          <BabalawoDashboardSidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
        </div>

        {/* Main content */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">
          <div className="max-w-7xl mx-auto">
            {SECTION_MAP[activeSection]}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation - only visible on mobile for logged in babalawos */}
      <MobileBottomNav userType="babalawo" />

      {/* Modals */}
      <WithdrawalRequestModal
        open={withdrawalModalOpen}
        onOpenChange={setWithdrawalModalOpen}
        onSuccess={() => {
          // Refresh earnings data
          if (activeSection === "earnings") {
            window.location.reload();
          }
        }}
      />

      <BankDetailsModal
        open={bankDetailsModalOpen}
        onOpenChange={setBankDetailsModalOpen}
        onSuccess={() => {
          toast({
            title: "Bank details updated",
            description: "Your bank details have been updated successfully"
          });
        }}
      />
    </div>
  );
};

export default BabalawoDashboard;
