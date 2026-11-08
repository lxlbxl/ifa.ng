import React from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { AdminNav } from './AdminNav';
import { AdminSection } from './adminSections';

interface AdminSidebarMobileProps {
  open: boolean;
  onClose: () => void;
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
}

const AdminSidebarMobile: React.FC<AdminSidebarMobileProps> = ({ open, onClose, activeSection, onSectionChange }) => (
  <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
    <SheetContent side="left" className="w-72 border-r-0 p-0 [&>button]:text-cloth">
      <SheetTitle className="sr-only">Admin menu</SheetTitle>
      <AdminNav
        activeSection={activeSection}
        onSectionChange={(s) => {
          onSectionChange(s);
          onClose();
        }}
      />
    </SheetContent>
  </Sheet>
);

export default AdminSidebarMobile;
