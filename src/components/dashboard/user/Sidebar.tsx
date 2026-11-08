
import React from 'react';
import { 
  Home, 
  Calendar, 
  History, 
  CreditCard, 
  Search, 
  Settings, 
  HelpCircle, 
  Wallet, 
  BookOpen, 
  Bell, 
  Award 
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSectionChange }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'my-sessions', label: 'My Sessions', icon: Calendar },
    { id: 'session-history', label: 'Session History', icon: History },
    { id: 'spiritual-journey', label: 'Spiritual Journey', icon: BookOpen },
    { id: 'find-babalawo', label: 'Find Babalawo', icon: Search },
    { id: 'transaction-history', label: 'Transactions', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'loyalty', label: 'Loyalty & Rewards', icon: Award },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'support', label: 'Support', icon: HelpCircle },
  ];

  return (
    <div className="w-64 xl:w-72 bg-white shadow-lg border-r border-gray-200 h-full flex flex-col">
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
            <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">IFA.ng</h2>
            <p className="text-xs sm:text-sm text-gray-500">User Dashboard</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-3 sm:p-4">
        <ul className="space-y-1 sm:space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-colors text-left text-sm sm:text-base ${
                    activeSection === item.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
