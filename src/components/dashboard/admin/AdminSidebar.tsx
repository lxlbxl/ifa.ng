
import React from 'react';
import { LayoutGrid, Users, UserCheck, Calendar, Wallet, Settings, Shield, BarChart, LifeBuoy } from 'lucide-react';

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeSection, onSectionChange }) => {
  const menuItems = [
    { icon: LayoutGrid, text: 'Dashboard', section: 'overview' },
    { icon: Users, text: 'User Management', section: 'users' },
    { icon: UserCheck, text: 'Babalawo Management', section: 'babalawos' },
    { icon: Calendar, text: 'Consultations', section: 'consultations' },
    { icon: Wallet, text: 'Payments', section: 'payments' },
    { icon: BarChart, text: 'Analytics', section: 'analytics' },
    { icon: Shield, text: 'Trust & Safety', section: 'safety' },
    { icon: Settings, text: 'Settings', section: 'settings' },
  ];

  return (
    <aside className="w-64 bg-gray-800 text-white flex-col hidden md:flex">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <span className="text-xl font-bold">Admin Panel</span>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.text}
            onClick={() => onSectionChange(item.section)}
            className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-colors duration-200 ${
              activeSection === item.section
                ? 'bg-indigo-500 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <item.icon className="h-5 w-5 mr-3" />
            <span className="font-medium">{item.text}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={() => onSectionChange('support')}
          className="w-full flex items-center px-4 py-2.5 text-gray-300 rounded-lg hover:bg-gray-700"
        >
          <LifeBuoy className="h-5 w-5 mr-3" />
          <span className="font-medium">Support</span>
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
