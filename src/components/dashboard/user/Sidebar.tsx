
import React from 'react';
import { Home, Calendar, History, Users, Settings, LifeBuoy } from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSectionChange }) => {
  const menuItems = [
    { icon: Home, text: 'Dashboard', section: 'dashboard' },
    { icon: Calendar, text: 'My Sessions', section: 'my-sessions' },
    { icon: History, text: 'Session History', section: 'session-history' },
    { icon: Users, text: 'Find a Babalawo', section: 'find-babalawo' },
    { icon: Settings, text: 'Settings', section: 'settings' },
  ];

  return (
    <aside className="w-64 bg-white shadow-lg flex-col hidden md:flex">
      <div className="p-6 border-b">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-lg">I</span>
          </div>
          <span className="text-xl font-bold text-gray-800">IFA Connect</span>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.text}
            onClick={() => onSectionChange(item.section)}
            className={`w-full flex items-center px-4 py-2.5 text-gray-600 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors duration-200 ${
              activeSection === item.section ? 'bg-primary/10 text-primary' : ''
            }`}
          >
            <item.icon className="h-5 w-5 mr-3" />
            <span className="font-medium">{item.text}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t">
        <button
          onClick={() => onSectionChange('support')}
          className={`w-full flex items-center px-4 py-2.5 text-gray-600 rounded-lg hover:bg-warm-light ${
            activeSection === 'support' ? 'bg-primary/10 text-primary' : ''
          }`}
        >
          <LifeBuoy className="h-5 w-5 mr-3" />
          <span className="font-medium">Support</span>
        </button>
      </div>
    </aside>
  );
};
export default Sidebar;
