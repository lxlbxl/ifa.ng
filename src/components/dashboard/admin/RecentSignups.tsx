
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRecentSignups } from "@/hooks/useRecentSignups";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

const RecentSignups = () => {
    const { data: users, isLoading, error } = useRecentSignups();

    if (isLoading) return <div className="flex justify-center items-center h-64"><div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" /><p>Loading signups...</p></div></div>;
    if (error) return <div className="text-red-500">Error: {error.message}</div>;
    if (!users || users.length === 0) return (
        <Card>
            <CardHeader>
                <CardTitle>Recent sign-ups</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">No recent user sign-ups.</p>
            </CardContent>
        </Card>
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Recent sign-ups</CardTitle>
                <CardDescription>The 5 most recent user sign-ups.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {users?.map(user => (
                        <div key={user.id} className="flex items-center">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || ''} />
                                <AvatarFallback className="bg-leaf font-bold text-ink">{user.full_name?.[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="ml-4 space-y-1">
                                <p className="text-sm font-medium leading-none">{user.full_name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                            <div className="ml-auto font-medium text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default RecentSignups;
