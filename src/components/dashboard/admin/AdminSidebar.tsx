import React from 'react';
import { LayoutGrid, Users, UserCheck, Wallet, Settings } from 'lucide-react';

interface AdminSidebarProps {
  activeSection: 'overview' | 'users' | 'babalawos' | 'finance' | 'settings';
  onSectionChange: (section: 'overview' | 'users' | 'babalawos' | 'finance' | 'settings') => void;
  className?: string;
}

const menuItems = [
  { icon: LayoutGrid, text: 'Dashboard', section: 'overview' },
  { icon: Users, text: 'User Management', section: 'users' },
  { icon: UserCheck, text: 'Babalawo Management', section: 'babalawos' },
  { icon: Wallet, text: 'Finance', section: 'finance' },
  { icon: Settings, text: 'Settings', section: 'settings' },
];

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeSection, onSectionChange, className }) => {
  return (
    <aside className={`w-64 bg-white text-gray-800 flex-col hidden md:flex border-r border-gray-100 pt-2 ${className || ''}`}>
      <div className="p-7 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 bg-indigo-100 rounded-full flex items-center justify-center">
            <span className="text-indigo-600 font-bold text-xl font-playfair">AD</span>
          </div>
          <span className="text-xl font-extrabold font-playfair tracking-tight">Admin Panel</span>
        </div>
      </div>
      <nav className="flex-1 p-5 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.text}
            onClick={() => onSectionChange(item.section as AdminSidebarProps['activeSection'])}
            className={`w-full flex items-center px-5 py-3 rounded-xl transition-colors duration-200 font-semibold
              ${
                activeSection === item.section
                  ? 'bg-indigo-100 text-indigo-700 shadow'
                  : 'text-gray-500 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
          >
            <item.icon className="h-5 w-5 mr-4" />
            <span>{item.text}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default AdminSidebar;
