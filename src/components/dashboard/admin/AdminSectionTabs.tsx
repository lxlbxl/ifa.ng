import React from 'react';
import { cn } from '@/lib/utils';
import { AdminSection, adminSections } from './adminSections';

interface AdminSectionTabsProps {
  activeSection: string;
  onSectionChange: (section: AdminSection) => void;
}

/** Horizontal pill switcher for phones and tablets (the sidebar covers desktop). */
const AdminSectionTabs: React.FC<AdminSectionTabsProps> = ({ activeSection, onSectionChange }) => (
  <div className="-mx-4 overflow-x-auto px-4 lg:hidden" role="tablist" aria-label="Admin sections">
    <div className="flex w-max gap-2 pb-1">
      {adminSections.map(({ section, short, icon: Icon }) => {
        const active = activeSection === section;
        return (
          <button
            key={section}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSectionChange(section)}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-pill px-4 text-sm font-bold transition-colors',
              active ? 'bg-ink text-cloth' : 'border border-line bg-paper text-ink hover:border-ink/40',
            )}
          >
            <Icon className="h-4 w-4" />
            {short}
          </button>
        );
      })}
    </div>
  </div>
);

export default AdminSectionTabs;
