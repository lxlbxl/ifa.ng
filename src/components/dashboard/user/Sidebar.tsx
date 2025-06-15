
import React from 'react';
import { Home, Calendar, History, Users, Settings, LifeBuoy } from 'lucide-react';

const Sidebar = () => {
  const menuItems = [
    { icon: Home, text: 'Dashboard', href: '/dashboard' },
    { icon: Calendar, text: 'My Sessions', href: '#' },
    { icon: History, text: 'Session History', href: '#' },
    { icon: Users, text: 'Find a Babalawo', href: '#' },
    { icon: Settings, text: 'Settings', href: '#' },
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
          <a
            key={item.text}
            href={item.href}
            className="flex items-center px-4 py-2.5 text-gray-600 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors duration-200"
          >
            <item.icon className="h-5 w-5 mr-3" />
            <span className="font-medium">{item.text}</span>
          </a>
        ))}
      </nav>
      <div className="p-4 border-t">
        <a
          href="#"
          className="flex items-center px-4 py-2.5 text-gray-600 rounded-lg hover:bg-warm-light"
        >
          <LifeBuoy className="h-5 w-5 mr-3" />
          <span className="font-medium">Support</span>
        </a>
      </div>
    </aside>
  );
};

export default Sidebar;
