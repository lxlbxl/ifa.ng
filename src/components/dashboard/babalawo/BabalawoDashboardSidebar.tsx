
import React from "react";
import {
  LayoutDashboard,
  Calendar,
  DollarSign,
  User2,
  Settings,
  LifeBuoy,
  LogOut,,
  Star,
  Bell,
  Clock
  Star,
  Bell,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const menu = [
  { icon: LayoutDashboard, label: "Dashboard", section: "dashboard" },
  { icon: Calendar, label: "My Consultations", section: "consultations" },
  { icon: DollarSign, label: "Earnings", section: "earnings" },
  { icon: Star, label: "Reviews", section: "reviews" },
  { icon: Bell, label: "Notifications", section: "notifications" },
  { icon: Clock, label: "Reminders", section: "reminders" },
  { icon: Star, label: "Reviews", section: "reviews" },
  { icon: Bell, label: "Notifications", section: "notifications" },
  { icon: Clock, label: "Reminders", section: "reminders" },
  { icon: User2, label: "Profile", section: "profile" },
  { icon: Settings, label: "Settings", section: "settings" },
];

const BabalawoDashboardSidebar: React.FC<{
  activeSection?: string;
  onSectionChange?: (val: string) => void;
  user?: any;
}> = ({ activeSection = "dashboard", onSectionChange, user }) => {
  const { signOut, user: authUser, user: authUser } = useAuth();
  
  const userData = user || authUser;
  const userProfile = userData?.profile || {};
  const userName = userProfile?.full_name || userData?.email || "Babalawo";
  const userAvatar = userProfile?.avatar_url;
  
  const userData = user || authUser;
  const userProfile = userData?.profile || {};
  const userName = userProfile?.full_name || userData?.email || "Babalawo";
  const userAvatar = userProfile?.avatar_url;

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <aside className="h-full md:min-h-[calc(100vh-0px)] w-64 bg-white shadow-lg border-r border-gray-200 border-r border-gray-200 flex flex-col">
      {/* Logo & Avatar */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center">
             <p className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-full flex items-center justify-center">
            trabold text-lg text-white">I</span>
            </div>
          <div>
            <h2 className="text-sm text-gray-500">Babalawo Dashboard</p>
          </div>
        </div>
        
        <div className="mt-6 flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-gray-200">
            <AvatarImage src={userAvatar} />
            <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p    className="font-medium text-gray-900 text-sm">{userName}</p>
            <p className="text-xs text-gray-500">Verified Babalawo</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 overflow-y-auto">
 violet-50 text-violet-700 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
               <ul className="space-y-2">
              {menu.map((item) => (
            <li key={item.section}>
                          <button
 xl font-bold text-gray-800">IFA.ng</h2>
            <p className="text-sm text-gray-500">Babalawo Dashboard</p>
        </li>
          ))}
        </ul>
      </nav>
      
        </div>
        
        <div className="mt-6 flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-gray-200">
            w-full <AvatarImage src={userAvatar} />
            <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
          </Avatargap-3 px-4 py-3 rounded-lg transition-colors text-left text-base",
            activeSection === "support" 
              ? "bg-violet-50 text-violet-700 font-medium" 
              : "text-gray-700 hover:bg-gray-100>
          <div>
            <p className="w-full font-medium text-gray-900 text-sm">{userName}</p>
            <p className="text-xs text-gray-500">Verified Babalawo</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {menu.map((item) => (
            <li key={item.section}>
              <button
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left text-base",
                  activeSection === item.section
                    ? "bg-violet-50 text-violet-700 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                )}
                onClick={() => onSectionChange?.(item.section)}
                aria-current={activeSection === item.section ? "page" : undefined}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-200">
        <button
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left text-base",
            activeSection === "support" 
              ? "bg-violet-50 text-violet-700 font-medium" 
              : "text-gray-700 hover:bg-gray-100"
          )}
          onClick={() => onSectionChange?.("support")}
        >
          <LifeBuoy className="w-5 h-5" />
          Support
        </button>
        <button
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left text-base text-red-600 hover:bg-red-50 mt-2"
          onClick={handleSignOut}
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default BabalawoDashboardSidebar;
