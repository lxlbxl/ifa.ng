
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';

const SignUpForm = () => {
  const { signUp } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;
    const role = formData.get('role') as 'user' | 'babalawo';

    try {
      const { error } = await signUp(email, password, fullName, role);

      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Check your email",
          description: "Please check your email for a verification link.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-name">Full Name</Label>
        <Input
          id="signup-name"
          name="fullName"
          required
          placeholder="Enter your full name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          required
          placeholder="Enter your email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          name="password"
          type="password"
          required
          placeholder="Create a password"
        />
      </div>
      <div className="space-y-3">
        <Label>I want to join as:</Label>
        <RadioGroup name="role" defaultValue="user" className="grid grid-cols-1 gap-4">
          <div className="flex items-center space-x-3 border rounded-lg p-3">
            <RadioGroupItem value="user" id="user" />
            <Label htmlFor="user" className="flex-1 cursor-pointer">
              <div className="font-medium">Seeker</div>
              <div className="text-sm text-gray-600">Looking for spiritual guidance</div>
            </Label>
          </div>
          <div className="flex items-center space-x-3 border rounded-lg p-3">
            <RadioGroupItem value="babalawo" id="babalawo" />
            <Label htmlFor="babalawo" className="flex-1 cursor-pointer">
              <div className="font-medium">Babalawo</div>
              <div className="text-sm text-gray-600">Providing spiritual guidance</div>
            </Label>
          </div>
        </RadioGroup>
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create Account
      </Button>
    </form>
  );
};

export default SignUpForm;
