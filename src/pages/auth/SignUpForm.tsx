
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';

const SignUpForm = ({ defaultRole = 'user' }: { defaultRole?: 'user' | 'babalawo' }) => {
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
        <Label htmlFor="signup-name">Full name</Label>
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
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-semibold">I'm joining as</legend>
        <RadioGroup name="role" defaultValue={defaultRole} className="grid grid-cols-2 gap-3">
          {[
            { value: 'user', title: 'Seeker', body: 'Looking for guidance', color: 'has-[[data-state=checked]]:bg-leaf' },
            { value: 'babalawo', title: 'Babalawo', body: 'Giving guidance', color: 'has-[[data-state=checked]]:bg-sun' },
          ].map((o) => (
            <Label
              key={o.value}
              htmlFor={`role-${o.value}`}
              className={`flex cursor-pointer flex-col gap-1 rounded-panel border-2 border-line bg-paper p-4 transition-colors has-[[data-state=checked]]:border-ink ${o.color}`}
            >
              <span className="flex items-center justify-between">
                <span className="font-display text-lg font-extrabold">{o.title}</span>
                <RadioGroupItem value={o.value} id={`role-${o.value}`} />
              </span>
              <span className="text-sm font-normal text-muted-foreground">{o.body}</span>
            </Label>
          ))}
        </RadioGroup>
      </fieldset>
      <Button type="submit" variant="sun" size="lg" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create account
      </Button>
    </form>
  );
};

export default SignUpForm;
