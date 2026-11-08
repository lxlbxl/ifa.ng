import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Logo } from '@/components/brand';
import { cn } from '@/lib/utils';
import { AdminSection, adminGroups, adminSections } from './adminSections';

/** Ink navigation column shared by the desktop sidebar and the mobile drawer. */
export const AdminNav = ({
  activeSection,
  onSectionChange,
}: {
  activeSection: AdminSection;
  onSectionChange: (s: AdminSection) => void;
}) => {
  const { signOut } = useAuth();
  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="flex h-full flex-col bg-ink text-cloth">
      <div className="flex items-center gap-3 px-6 pb-6 pt-7">
        <Logo tone="light" size="sm" />
        <span className="rounded-pill bg-sun px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink">Admin</span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Admin">
        {adminGroups.map((g) => (
          <div key={g}>
            <div className="eyebrow mb-1.5 px-3 text-cloth/45">{g}</div>
            {adminSections
              .filter((i) => i.group === g)
              .map((item) => {
                const active = activeSection === item.section;
                return (
                  <button
                    key={item.section}
                    type="button"
                    onClick={() => onSectionChange(item.section)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-pill px-3 py-2.5 text-[15px] font-semibold transition-colors',
                      active ? 'bg-leaf text-ink' : 'text-cloth/75 hover:bg-white/10 hover:text-cloth',
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] flex-none" />
                    {item.label}
                  </button>
                );
              })}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-pill px-3 py-2.5 text-[15px] font-semibold text-cloth/75 hover:bg-coral hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign out
        </button>
      </div>
    </div>
  );
};

export default AdminNav;
