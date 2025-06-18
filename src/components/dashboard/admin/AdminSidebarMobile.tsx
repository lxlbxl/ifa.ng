
import React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  DrawerTitle,
} from "@/components/ui/drawer";
import { LayoutGrid, Users, UserCheck, Wallet, Settings, X, CreditCard, History } from "lucide-react";

interface AdminSidebarMobileProps {
  open: boolean;
  onClose: () => void;
  activeSection: 'overview' | 'users' | 'babalawos' | 'finance' | 'transactions' | 'wallet-management' | 'settings';
  onSectionChange: (section: 'overview' | 'users' | 'babalawos' | 'finance' | 'transactions' | 'wallet-management' | 'settings') => void;
}

const menuItems = [
  { icon: LayoutGrid, text: 'Dashboard', section: 'overview' },
  { icon: Users, text: 'User Management', section: 'users' },
  { icon: UserCheck, text: 'Babalawo Management', section: 'babalawos' },
  { icon: Wallet, text: 'Finance', section: 'finance' },
  { icon: History, text: 'Transactions', section: 'transactions' },
  { icon: CreditCard, text: 'Wallet Management', section: 'wallet-management' },
  { icon: Settings, text: 'Settings', section: 'settings' },
];

const AdminSidebarMobile: React.FC<AdminSidebarMobileProps> = ({
  open,
  onClose,
  activeSection,
  onSectionChange,
}) => {
  return (
    <Drawer open={open} onOpenChange={onClose} direction="left">
      <DrawerOverlay className="z-40" />
      <DrawerContent
        className="z-50 w-64 bg-white text-gray-900 p-0 flex flex-col h-full"
        style={{ minHeight: "100vh" }}
      >
        <DrawerHeader className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-indigo-600 font-bold text-lg font-playfair">AD</span>
            </div>
            <DrawerTitle className="text-lg font-bold font-playfair tracking-tight">Admin Panel</DrawerTitle>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-indigo-100">
            <X size={22} />
          </button>
        </DrawerHeader>
        <nav className="flex-1 py-4">
          {menuItems.map((item) => (
            <button
              key={item.text}
              onClick={() => {
                onSectionChange(item.section as AdminSidebarMobileProps['activeSection']);
                onClose();
              }}
              className={`w-full flex items-center px-6 py-4 text-base rounded-xl transition-colors duration-200 font-semibold
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
      </DrawerContent>
    </Drawer>
  );
};

export default AdminSidebarMobile;
