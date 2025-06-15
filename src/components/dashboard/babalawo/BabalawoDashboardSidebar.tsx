
import React from "react";
import {
  LayoutDashboard,
  Calendar,
  DollarSign,
  User2,
  Settings,
  LifeBuoy,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const menu = [
  { icon: LayoutDashboard, label: "Dashboard", section: "dashboard" },
  { icon: Calendar, label: "My Consultations", section: "consultations" },
  { icon: DollarSign, label: "Earnings", section: "earnings" },
  { icon: User2, label: "Profile", section: "profile" },
  { icon: Settings, label: "Settings", section: "settings" },
];

const BabalawoDashboardSidebar: React.FC<{
  activeSection?: string;
  onSectionChange?: (val: string) => void;
}> = ({ activeSection = "dashboard", onSectionChange }) => {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <aside className="h-full md:min-h-[calc(100vh-0px)] w-64 bg-gradient-to-br from-[#7b61ff] to-[#7f53ac] text-white shadow-xl flex flex-col">
      {/* Logo & Avatar */}
      <div className="flex flex-col items-center py-8 px-4">
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3">
          <span className="font-extrabold text-2xl text-white">I</span>
        </div>
        <span className="font-extrabold text-lg tracking-wider uppercase">IFA Connect</span>
        <span className="text-xs mt-1 opacity-60">Babalawo</span>
      </div>
      <nav className="flex-1 flex flex-col gap-1 mt-2 px-3">
        {menu.map((item) => (
          <button
            key={item.section}
            className={cn(
              "flex items-center w-full rounded-lg px-4 py-2 font-medium gap-3 transition-all",
              activeSection === item.section
                ? "bg-white/20 shadow-md text-white"
                : "hover:bg-white/10 text-white/80"
            )}
            onClick={() => onSectionChange?.(item.section)}
            aria-current={activeSection === item.section ? "page" : undefined}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="pt-4 pb-2 px-3 border-t border-white/10">
        <button
          className={cn(
            "flex items-center w-full rounded-lg px-4 py-2 font-medium gap-3 transition-all hover:bg-white/10 text-white/80",
            activeSection === "support" && "bg-white/20 shadow-md text-white"
          )}
          onClick={() => onSectionChange?.("support")}
        >
          <LifeBuoy className="w-5 h-5" />
          Support
        </button>
        <button
          className="flex items-center w-full rounded-lg px-4 py-2 font-medium gap-3 transition-all hover:bg-red-500/20 text-white/80 hover:text-white mt-2"
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
