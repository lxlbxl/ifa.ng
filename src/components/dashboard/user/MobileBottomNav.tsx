import React from 'react';
import { Home, Calendar, Search, Heart, User, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeSection, onSectionChange }) => {
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'my-sessions', label: 'Sessions', icon: Calendar },
    { id: 'find-babalawo', label: 'Find', icon: Search },
    { id: 'loyalty', label: 'Loyalty', icon: Heart },
    { id: 'settings', label: 'Profile', icon: User },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50 safe-area-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-all duration-200",
                "active:scale-95"
              )}
            >
              <div
                className={cn(
                  "flex flex-col items-center justify-center transition-all duration-200",
                  isActive && "transform -translate-y-1"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-br from-orange-500 to-pink-500 shadow-lg"
                      : "bg-transparent"
                  )}
                >
                  <Icon
                    className={cn(
                      "transition-all duration-200",
                      isActive ? "text-white w-5 h-5" : "text-gray-500 w-6 h-6"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-xs mt-1 font-medium transition-all duration-200",
                    isActive
                      ? "text-orange-600 font-semibold"
                      : "text-gray-500"
                  )}
                >
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
