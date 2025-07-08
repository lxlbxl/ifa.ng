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
import BabalawoConsultationsPanel from "@/components/dashboard/babalawo/BabalawoConsultationPanel";
import BabalawoProfileSettings from "@/components/dashboard/babalawo/BabalawoProfileSettings";
import BabalawoEarnings from "@/components/dashboard/babalawo/BabalawoEarnings";
import BabalawoReviews from "@/components/dashboard/babalawo/BabalawoReviews";
import WithdrawalRequestModal from "@/components/dashboard/babalawo/WithdrawalRequestModal";
import BankDetailsModal from "@/components/dashboard/babalawo/BankDetailsModal";
import Settings from "@/components/dashboard/user/Settings";
import Support from "@/components/dashboard/user/Support";
import Notifications from "@/components/dashboard/user/Notifications";

// Create a new Reminders component
const Reminders = () => {
  return (
    <div className="bg-white/50 p-6 rounded-xl shadow-md">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-semibold text-gray-800">Reminders</h2>
      </div>
      
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Session Reminders</h3>
          <p className="text-gray-600 mb-4">
            Set reminders for upcoming sessions to ensure you're prepared and on time.
          </p>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">10 minutes before session</p>
                <p className="text-sm text-gray-500">Get ready to join</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">30 minutes before session</p>
                <p className="text-sm text-gray-500">Prepare your space</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">1 hour before session</p>
                <p className="text-sm text-gray-500">Final preparation</p>
              </div>
              <Switch />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Ritual/Ebo/Etutu Reminders</h3>
          <p className="text-gray-600 mb-4">
            Create reminders for rituals or spiritual practices you've prescribed to clients.
          </p>
          <Button className="w-full">Add New Reminder</Button>
          
          <div className="mt-4 space-y-3">
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="flex justify-between">
                <p className="font-medium">Ebo for Client: Adunni O.</p>
                <Badge>Tomorrow</Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">Offering at the river</p>
            </div>
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="flex justify-between">
                <p className="font-medium">Etutu for Client: Michael T.</p>
                <Badge variant="outline">In 3 days</Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">Cleansing ritual</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Warning Reminders</h3>
          <p className="text-gray-600 mb-4">
            Set reminders for important warnings given to clients.
          </p>
          <Button className="w-full">Add New Warning</Button>
          
          <div className="mt-4 space-y-3">
            <div className="p-3 border border-orange-200 bg-orange-50 rounded-lg">
              <div className="flex justify-between">
                <p className="font-medium">Warning for Client: Fatima A.</p>
                <Badge variant="outline" className="text-orange-700 bg-orange-100">Important</Badge>
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
  consultations: <BabalawoConsultationsPanel />,
  earnings: <BabalawoEarnings />,
  reviews: <BabalawoReviews />,
  notifications: <Notifications />,
  reminders: <Reminders />,
  profile: <BabalawoProfileSettings />,
  settings: <Settings />,
  support: <Support />,
};

const BabalawoDashboardHeader = ({ activeSection, onSectionChange }: { activeSection: string, onSectionChange: (section: string) => void }) => {
  const { user, userProfile } = useAuth();
  const userName = userProfile?.full_name || user?.email || "Babalawo";
  const userAvatar = userProfile?.avatar_url;
  return (
    <header className="bg-white border-b border-gray-200 py-3 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      <div className="flex items-center lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-2">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <BabalawoDashboardSidebar 
              activeSection={activeSection} 
              onSectionChange={onSectionChange} 
            />
          </SheetContent>
        </Sheet>
        
        <h1 className="text-xl font-semibold text-gray-900">
          {activeSection.charAt(0).toUpperCase() + activeSection.slice(1) || 'Dashboard'}
        </h1>
      </div>
      
      <div className="hidden lg:block">
        <h1 className="text-xl font-semibold text-gray-900">
          {activeSection.charAt(0).toUpperCase() + activeSection.slice(1) || 'Dashboard'}
        </h1>
      </div>
      
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          className="relative"
          onClick={() => onSectionChange('notifications')}
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
        </Button>
        
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border border-gray-200">
            <AvatarImage src={userAvatar} />
            <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-gray-700 hidden sm:inline-block">{userName}</span>
        </div>
      </div>
    </header>
  );
};

const BabalawoDashboard = () => {
  const [activeSection, setActiveSection] = useState<string>("dashboard");
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
    <div className="min-h-screen w-full bg-gradient-to-br from-violet-50 to-indigo-50 flex flex-col">
      <BabalawoDashboardHeader 
        activeSection={activeSection} 
        onSectionChange={setActiveSection} 
      />
      
      <div className="flex flex-1 min-h-0 w-full">
        <div className="hidden lg:block">
          <BabalawoDashboardSidebar 
            activeSection={activeSection} 
            onSectionChange={setActiveSection} 
          />
        </div>
        
        {/* Main content */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {SECTION_MAP[activeSection]}
          </div>
        </main>
      </div>
      
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
