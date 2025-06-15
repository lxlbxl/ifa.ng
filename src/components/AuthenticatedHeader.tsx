
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Settings, Calendar } from 'lucide-react';
import UserProfile from './UserProfile';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

const AuthenticatedHeader = () => {
  const { user, userProfile, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center space-x-4">
        <Button variant="outline" asChild>
          <a href="/auth">Sign In</a>
        </Button>
        <Button asChild>
          <a href="/auth">Get Started</a>
        </Button>
      </div>
    );
  }

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex items-center space-x-4">
      {userProfile?.role === 'babalawo' && (
        <Button variant="outline" size="sm">
          <Calendar className="mr-2 h-4 w-4" />
          My Schedule
        </Button>
      )}

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage src={userProfile?.avatar_url} />
                <AvatarFallback>
                  {userProfile?.full_name 
                    ? getInitials(userProfile.full_name) 
                    : user.email?.[0]?.toUpperCase()
                  }
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col space-y-1 leading-none">
                <p className="font-medium">{userProfile?.full_name || 'User'}</p>
                <p className="w-[200px] truncate text-sm text-muted-foreground">
                  {user.email}
                </p>
                <p className="text-xs text-blue-600 capitalize">
                  {userProfile?.role}
                </p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DialogTrigger asChild>
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
            </DialogTrigger>
            {userProfile?.role === 'babalawo' && (
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Babalawo Settings
              </DropdownMenuItem>
            )}
            {userProfile?.role === 'admin' && (
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Admin Panel
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <DialogContent className="sm:max-w-md">
          <UserProfile />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuthenticatedHeader;
