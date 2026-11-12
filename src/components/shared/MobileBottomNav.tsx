import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Home,
  Calendar,
  Wallet,
  User,
  Settings,
  Users,
  DollarSign,
  BarChart3,
  MessageSquare,
  Search,
  Award,
  Heart,
  Clock,
} from 'lucide-react';

type UserType = 'user' | 'babalawo' | 'admin';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
}

interface MobileBottomNavProps {
  userType: UserType;
  className?: string;
}

const USER_NAV_ITEMS: NavItem[] = [
  {
    icon: <Home className="w-5 h-5" />,
    label: 'Home',
    path: '/dashboard',
  },
  {
    icon: <Search className="w-5 h-5" />,
    label: 'Find',
    path: '/search',
  },
  {
    icon: <Calendar className="w-5 h-5" />,
    label: 'Sessions',
    path: '/dashboard?tab=my-sessions',
  },
  {
    icon: <Wallet className="w-5 h-5" />,
    label: 'Wallet',
    path: '/dashboard?tab=transaction-history',
  },
  {
    icon: <User className="w-5 h-5" />,
    label: 'Profile',
    path: '/dashboard?tab=settings',
  },
];

const BABALAWO_NAV_ITEMS: NavItem[] = [
  {
    icon: <Home className="w-5 h-5" />,
    label: 'Dashboard',
    path: '/dashboard',
  },
  {
    icon: <Calendar className="w-5 h-5" />,
    label: 'Sessions',
    path: '/dashboard?tab=consultations',
  },
  {
    icon: <DollarSign className="w-5 h-5" />,
    label: 'Payments',
    path: '/dashboard?tab=payments',
  },
  {
    icon: <Clock className="w-5 h-5" />,
    label: 'Hours',
    path: '/dashboard?tab=availability',
  },
  {
    icon: <Settings className="w-5 h-5" />,
    label: 'Settings',
    path: '/dashboard?tab=settings',
  },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    icon: <Home className="w-5 h-5" />,
    label: 'Overview',
    path: '/dashboard',
  },
  {
    icon: <Users className="w-5 h-5" />,
    label: 'Users',
    path: '/dashboard?section=users',
  },
  {
    icon: <Heart className="w-5 h-5" />,
    label: 'Babalawos',
    path: '/dashboard?section=babalawos',
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    label: 'Finance',
    path: '/dashboard?section=finance',
  },
  {
    icon: <Settings className="w-5 h-5" />,
    label: 'Settings',
    path: '/dashboard?section=settings',
  },
];

const NAV_CONFIG: Record<UserType, NavItem[]> = {
  user: USER_NAV_ITEMS,
  babalawo: BABALAWO_NAV_ITEMS,
  admin: ADMIN_NAV_ITEMS,
};

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  userType,
  className,
}) => {
  const location = useLocation();
  const navItems = NAV_CONFIG[userType];

  const isActive = (path: string) => {
    const [pathname, query = ''] = path.split('?');
    if (pathname !== location.pathname) return false;
    // A link is on when the page asks for the same section (?tab= or ?section=).
    const want = new URLSearchParams(query);
    const have = new URLSearchParams(location.search);
    const wantKey = want.has('section') ? 'section' : 'tab';
    const wanted = want.get(wantKey);
    const current = have.get('section') ?? have.get('tab');
    return wanted ? current === wanted : !current;
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 md:hidden',
        'bg-white/95 backdrop-blur-lg border-t border-gray-200',
        'shadow-[0_-4px_20px_rgba(0,0,0,0.08)]',
        'safe-area-inset-bottom',
        className
      )}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item, index) => {
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'relative flex flex-col items-center justify-center',
                'flex-1 h-full gap-1 transition-all duration-300 ease-out',
                'group'
              )}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              {/* Active indicator */}
              <div
                className={cn(
                  'absolute top-0 left-1/2 -translate-x-1/2',
                  'h-1 rounded-b-full transition-all duration-300 ease-out',
                  active
                    ? 'w-12 bg-gradient-to-r from-primary via-purple-500 to-primary'
                    : 'w-0 bg-transparent'
                )}
              />

              {/* Icon container with animated background */}
              <div
                className={cn(
                  'relative flex items-center justify-center',
                  'w-10 h-10 rounded-xl transition-all duration-300 ease-out',
                  'transform group-hover:scale-110 group-active:scale-95',
                  active
                    ? 'bg-primary/10 text-primary scale-105'
                    : 'text-gray-500 group-hover:bg-gray-100'
                )}
              >
                {/* Pulse effect on active */}
                {active && (
                  <div className="absolute inset-0 rounded-xl bg-primary/20 animate-ping" />
                )}

                <div className="relative z-10">{item.icon}</div>

                {/* Badge if present */}
                {item.badge && item.badge > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                    {item.badge > 9 ? '9+' : item.badge}
                  </div>
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'text-xs font-medium transition-all duration-300',
                  'transform group-hover:translate-y-[-1px]',
                  active
                    ? 'text-primary font-semibold'
                    : 'text-gray-600 group-hover:text-gray-900'
                )}
              >
                {item.label}
              </span>

              {/* Ripple effect on tap */}
              <div className="absolute inset-0 overflow-hidden rounded-xl">
                <div className="absolute inset-0 bg-primary/5 scale-0 group-active:scale-100 transition-transform duration-200 ease-out rounded-full" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Safe area spacer for devices with notch */}
      <div className="h-safe-area-inset-bottom bg-white/95" />
    </nav>
  );
};
