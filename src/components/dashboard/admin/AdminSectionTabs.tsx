
import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Users, UserCheck, Wallet, Settings, CreditCard, History } from "lucide-react";

interface AdminSectionTabsProps {
  activeSection: string;
  onSectionChange: (section: 'overview' | 'users' | 'babalawos' | 'finance' | 'transactions' | 'wallet-management' | 'settings') => void;
}

const tabItems = [
  { value: "overview", label: "Overview", icon: LayoutGrid },
  { value: "users", label: "Users", icon: Users },
  { value: "babalawos", label: "Babalawos", icon: UserCheck },
  { value: "finance", label: "Finance", icon: Wallet },
  { value: "transactions", label: "Transactions", icon: History },
  { value: "wallet-management", label: "Wallet Mgmt", icon: CreditCard },
  { value: "settings", label: "Settings", icon: Settings },
];

const AdminSectionTabs: React.FC<AdminSectionTabsProps> = ({ activeSection, onSectionChange }) => {
  return (
    <div className="w-full">
      <Tabs value={activeSection} onValueChange={onSectionChange} className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex h-12 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground min-w-max w-full">
            {tabItems.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger 
                  key={item.value}
                  value={item.value} 
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm min-w-max"
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
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
