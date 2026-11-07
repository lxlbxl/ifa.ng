import { Link, NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Logo } from '@/components/brand/Logo';
import InstallButton from '@/components/pwa/InstallButton';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const links = [
  { to: '/search', label: 'Babalawos' },
  { to: '/#sessions', label: 'Sessions' },
  { to: '/#how', label: 'How it works' },
  { to: '/#verse', label: 'Daily verse' },
  { to: '/#join', label: 'For Babalawos' },
];

interface HeaderProps {
  /** "overlay" floats white over a dark hero; "solid" is a sticky cloth bar for inner pages. */
  variant?: 'overlay' | 'solid';
}

/** Public site header shared by the homepage and every public page. */
const Header = ({ variant = 'solid' }: HeaderProps) => {
  const { user } = useAuth();
  const overlay = variant === 'overlay';

  return (
    <header
      className={cn(
        'z-40 w-full',
        overlay ? 'absolute inset-x-0 top-0 text-white' : 'sticky top-0 border-b border-line bg-cloth/90 text-ink backdrop-blur-md',
      )}
    >
      <div className={cn('wrap flex items-center gap-6', overlay ? 'h-[84px]' : 'h-[72px]')}>
        <Logo tone={overlay ? 'light' : 'dark'} />

        <nav className="ml-auto hidden items-center gap-6 text-[15px] font-semibold lg:flex" aria-label="Main">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  'no-underline opacity-90 underline-offset-[5px] hover:underline hover:opacity-100',
                  isActive && l.to === '/search' && 'underline opacity-100',
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <InstallButton label="Install app" buttonVariant={overlay ? 'glass' : 'outline'} className="h-11 px-4" />
          <Link
            to={user ? '/dashboard' : '/auth'}
            className="hidden px-2 text-[15px] font-semibold no-underline opacity-90 hover:underline hover:opacity-100 sm:inline"
          >
            {user ? 'Dashboard' : 'Sign in'}
          </Link>
          <Button asChild variant="sun" size="sm" className="hidden h-11 px-5 text-sm sm:inline-flex">
            <Link to="/search">Book a consultation</Link>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant={overlay ? 'glass' : 'outline'}
                size="icon"
                className="h-11 w-11 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="!h-5 !w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="flex flex-col gap-0 border-l-0 bg-ink p-0 text-cloth">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="p-6">
                <Logo tone="light" />
              </div>
              <nav className="flex flex-col px-6" aria-label="Mobile">
                {links.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="border-b border-white/10 py-4 font-display text-3xl font-extrabold tracking-[-0.03em] no-underline"
                  >
                    {l.label}
                  </Link>
                ))}
                <Link
                  to={user ? '/dashboard' : '/auth'}
                  className="py-4 font-display text-3xl font-extrabold tracking-[-0.03em] text-leaf no-underline"
                >
                  {user ? 'Dashboard' : 'Sign in'}
                </Link>
              </nav>
              <div className="mt-auto space-y-3 p-6 pb-safe">
                <InstallButton variant="block" label="Install the app" buttonVariant="glass" />
                <Button asChild variant="sun" size="lg" className="w-full">
                  <Link to="/search">Book a consultation</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;
