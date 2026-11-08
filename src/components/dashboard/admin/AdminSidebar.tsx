import React from 'react';
import { AdminNav } from './AdminNav';
import { AdminSection } from './adminSections';

interface AdminSidebarProps {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  className?: string;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeSection, onSectionChange, className }) => (
  <aside className={`sticky top-0 hidden h-screen w-64 flex-none md:block ${className || ''}`}>
    <AdminNav activeSection={activeSection} onSectionChange={onSectionChange} />
  </aside>
);

export default AdminSidebar;
