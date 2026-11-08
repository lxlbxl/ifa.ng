import React from 'react';
import {
  Home,
  Calendar,
  Search,
  Settings,
  User
} from 'lucide-react';
import { motion } from 'framer-motion';

interface MobileBottomNavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeSection, onSectionChange }) => {
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'my-sessions', label: 'Sessions', icon: Calendar },
    { id: 'find-babalawo', label: 'Find', icon: Search },
    { id: 'spiritual-journey', label: 'Journey', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className="flex flex-col items-center justify-center flex-1 relative py-2 px-1 min-w-0"
              aria-label={item.label}
            >
              <motion.div
                className="relative"
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -inset-3 bg-primary/10 rounded-2xl"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30
                    }}
                  />
                )}
                <div className="relative z-10 flex flex-col items-center gap-1">
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? 'text-primary' : 'text-gray-500'
                    }`}
                  />
                  <span
                    className={`text-xs font-medium transition-colors ${
                      isActive ? 'text-primary' : 'text-gray-500'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              </motion.div>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
