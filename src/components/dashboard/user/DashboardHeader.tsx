
import React from 'react';
import AuthenticatedHeader from '@/components/AuthenticatedHeader';
import { useAuth } from '@/hooks/useAuth';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import UserDashboardSidebarDrawer from './UserDashboardSidebarDrawer';

interface DashboardHeaderProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ activeSection, onSectionChange }) => {
  const { userProfile } = useAuth();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <header className="bg-white/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center justify-between h-20 px-6 md:px-8 lg:px-10 border-b">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Welcome, {userProfile?.full_name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-gray-500">Here's your spiritual journey summary.</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Hamburger menu for mobile */}
          <div className="md:hidden">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <button
                  className="p-2 rounded-full hover:bg-gray-200"
                  aria-label="Open menu"
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                >
                  <Menu className="h-6 w-6 text-gray-600" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 max-w-xs">
                <UserDashboardSidebarDrawer
                  activeSection={activeSection}
                  onSectionChange={onSectionChange}
                  onClose={() => setDrawerOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </div>
          <AuthenticatedHeader />
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
