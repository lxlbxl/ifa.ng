import React from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/brand';

interface AdminHeaderProps {
  title?: string;
  onOpenMenu?: () => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ title = 'Overview', onOpenMenu }) => {
  const { userProfile } = useAuth();
  const name = userProfile?.full_name || 'Admin';
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex items-end gap-3">
        {onOpenMenu && (
          <Button variant="outline" size="icon" className="h-11 w-11 flex-none lg:hidden" onClick={onOpenMenu} aria-label="Open admin menu">
            <Menu className="!h-5 !w-5" />
          </Button>
        )}
        <div>
          <Eyebrow className="text-camwood">Admin · Ẹ kú iṣẹ́, {name.split(' ')[0]}</Eyebrow>
          <h1 className="mt-2 font-display text-display-sm font-extrabold">{title}</h1>
        </div>
      </div>
      <div className="hidden items-center gap-2.5 rounded-pill border border-line bg-paper py-1.5 pl-1.5 pr-4 sm:flex">
        <Avatar className="h-9 w-9">
          <AvatarImage src={userProfile?.avatar_url || ''} />
          <AvatarFallback className="bg-leaf font-bold text-ink">{name[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="leading-tight">
          <span className="block text-sm font-bold">{name}</span>
          <span className="block text-xs text-muted-foreground">Administrator</span>
        </div>
      </div>
    </div>
  );
};

export default AdminHeader;
