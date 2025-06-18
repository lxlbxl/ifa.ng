
import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminSectionTabsProps {
  activeSection: string;
  onSectionChange: (section: 'overview' | 'users' | 'babalawos' | 'finance' | 'transactions' | 'wallet-management' | 'settings') => void;
}

const AdminSectionTabs: React.FC<AdminSectionTabsProps> = ({ activeSection, onSectionChange }) => {
  return (
    <div className="w-full overflow-x-auto">
      <Tabs value={activeSection} onValueChange={onSectionChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 min-w-max">
          <TabsTrigger value="overview" className="text-xs sm:text-sm whitespace-nowrap">Overview</TabsTrigger>
          <TabsTrigger value="users" className="text-xs sm:text-sm whitespace-nowrap">Users</TabsTrigger>
          <TabsTrigger value="babalawos" className="text-xs sm:text-sm whitespace-nowrap">Babalawos</TabsTrigger>
          <TabsTrigger value="finance" className="text-xs sm:text-sm whitespace-nowrap">Finance</TabsTrigger>
          <TabsTrigger value="transactions" className="text-xs sm:text-sm whitespace-nowrap">Transactions</TabsTrigger>
          <TabsTrigger value="wallet-management" className="text-xs sm:text-sm whitespace-nowrap">Wallet Mgmt</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm whitespace-nowrap">Settings</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};

export default AdminSectionTabs;
