import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Users, UserCheck, Wallet, Settings, CreditCard, History, Banknote } from "lucide-react"; // Import Banknote icon

interface AdminSectionTabsProps {
  activeSection: string;
  onSectionChange: (section: 'overview' | 'users' | 'babalawos' | 'finance' | 'transactions' | 'wallet-management' | 'settings' | 'withdrawal-management') => void; // Add new section type
}

const tabItems = [
  { value: "overview", label: "Overview", icon: LayoutGrid },
  { value: "users", label: "Users", icon: Users },
  { value: "babalawos", label: "Babalawos", icon: UserCheck },
  { value: "finance", label: "Finance", icon: Wallet },
  { value: "transactions", label: "Transactions", icon: History },
  { value: "wallet-management", label: "Wallet Mgmt", icon: CreditCard },
  { value: "withdrawal-management", label: "Withdrawals", icon: Banknote }, // Add new tab item
  { value: "settings", label: "Settings", icon: Settings },
];

const AdminSectionTabs: React.FC<AdminSectionTabsProps> = ({ activeSection, onSectionChange }) => {
  const handleTabChange = (value: string) => {
    onSectionChange(value as 'overview' | 'users' | 'babalawos' | 'finance' | 'transactions' | 'wallet-management' | 'settings' | 'withdrawal-management');
  };

  return (
    <div className="w-full">
      <Tabs value={activeSection} onValueChange={handleTabChange} className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="flex h-12 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-full min-w-max">
            {tabItems.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger 
                  key={item.value}
                  value={item.value} 
                  className="flex items-center justify-center gap-2 whitespace-nowrap rounded-sm px-2 sm:px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex-1 sm:flex-initial min-w-0"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline truncate">{item.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      </Tabs>
    </div>
  );
};

export default AdminSectionTabs;
