import React from 'react';
import { Home, Calendar, Search, Heart, User } from 'lucide-react';
import { motion } from 'framer-motion';
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
            <motion.button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className="flex flex-col items-center justify-center flex-1 h-full relative"
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <motion.div
                className="flex flex-col items-center justify-center"
                animate={{
                  y: isActive ? -4 : 0,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <motion.div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-2xl",
                    isActive && "bg-gradient-to-br from-orange-500 to-pink-500 shadow-lg"
                  )}
                  animate={{
                    scale: isActive ? 1 : 0.95,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <motion.div
                    animate={{
                      scale: isActive ? 1 : 1.15,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <Icon
                      className={cn(
                        "transition-colors duration-200",
                        isActive ? "text-white w-5 h-5" : "text-gray-500 w-5 h-5"
                      )}
                    />
                  </motion.div>
                </motion.div>
                <motion.span
                  className={cn(
                    "text-xs mt-1 font-medium",
                    isActive
                      ? "text-orange-600 font-semibold"
                      : "text-gray-500"
                  )}
                  animate={{
                    opacity: isActive ? 1 : 0.7,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {item.label}
                </motion.span>
              </motion.div>

              {/* Active indicator ripple effect */}
              {isActive && (
                <motion.div
                  className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 48 }}
                  transition={{ duration: 0.3, type: "spring" }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
