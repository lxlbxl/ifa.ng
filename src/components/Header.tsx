import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import InstallButton from '@/components/pwa/InstallButton';

const Header = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link to="/" className="text-xl font-bold text-primary">
            Ifa Connect
          </Link>
        </div>

        {/* Desktop Menu */}
        <nav className="hidden md:flex items-center gap-6">
          <InstallButton />
          <Link to="/search" className="text-sm font-medium text-gray-600 hover:text-primary">
            Find a Babalawo
          </Link>
          {user ? (
            <Link to="/dashboard" className="text-sm font-medium text-gray-600 hover:text-primary">
              Dashboard
            </Link>
          ) : (
            <Link to="/auth" className="text-sm font-medium text-gray-600 hover:text-primary">
              Sign In
            </Link>
          )}
        </nav>

        {/* Mobile Menu */}
        <div className="md:hidden flex items-center gap-1">
          <InstallButton label="Install" />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <nav className="flex flex-col gap-4 mt-8">
                <InstallButton variant="block" />
                <Link to="/search" className="text-lg font-medium">
                  Find a Babalawo
                </Link>
                {user ? (
                  <Link to="/dashboard" className="text-lg font-medium">
                    Dashboard
                  </Link>
                ) : (
                  <Link to="/auth" className="text-lg font-medium">
                    Sign In
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;
