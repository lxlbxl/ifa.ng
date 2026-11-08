import React, { useState, useEffect } from 'react';
import { Bell, Check, X, Info, AlertTriangle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type NotificationType = 'info' | 'warning' | 'success' | 'appointment';

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  type: NotificationType;
  action_url?: string;
}

const NotificationItem: React.FC<{
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}> = ({ notification, onMarkRead, onDismiss }) => {
  // Get icon based on notification type
  const getIcon = () => {
    switch (notification.type) {
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'success':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'appointment':
        return <Calendar className="h-5 w-5 text-purple-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <Card className={`mb-3 ${notification.read ? 'bg-gray-50' : 'bg-white border-l-4 border-l-primary'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1">{getIcon()}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">{notification.title}</h4>
              <div className="flex items-center gap-1">
                {!notification.read && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0" 
                    onClick={() => onMarkRead(notification.id)}
                  >
                    <Check className="h-4 w-4" />
                    <span className="sr-only">Mark as read</span>
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 text-gray-500 hover:text-red-500" 
                  onClick={() => onDismiss(notification.id)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Dismiss</span>
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-500">
                {new Date(notification.created_at).toLocaleDateString()}
              </span>
              {notification.action_url && (
                <Button variant="link" size="sm" className="h-6 p-0" asChild>
                  <a href={notification.action_url}>View Details</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (error) throw error;
        
        // Convert to our notification format
        // In a real app, you would make sure the DB schema matches this type
        setNotifications(data as unknown as Notification[]);
      } catch (err: any) {
        console.error('Error fetching notifications:', err);
        setError(err.message || 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };
    
    fetchNotifications();
    
    // Set up subscription for real-time notifications
    const subscription = supabase
      .channel('notifications')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${user.id}` 
        }, 
        (payload) => {
          setNotifications(prev => [payload.new as unknown as Notification, ...prev]);
          
          toast({
            title: "New notification",
            description: (payload.new as any).title || "You have a new notification",
          });
        }
      )
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, toast]);
  
  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
        
      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id ? { ...notification, read: true } : notification
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
      toast({
        title: "Error",
        description: "Failed to update notification",
        variant: "destructive",
      });
    }
  };
  
  const handleDismiss = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      // Update local state
      setNotifications(prev => prev.filter(notification => notification.id !== id));
    } catch (err) {
      console.error('Error dismissing notification:', err);
      toast({
        title: "Error",
        description: "Failed to dismiss notification",
        variant: "destructive",
      });
    }
  };
  
  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter(n => !n.read)
        .map(n => n.id);
        
      if (unreadIds.length === 0) return;
      
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', unreadIds);
        
      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
      
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      toast({
        title: "Error",
        description: "Failed to update notifications",
        variant: "destructive",
      });
    }
  };

  // Fallback for no data
  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg"></div>
        ))}
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
        <p className="text-gray-700">Failed to load notifications</p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-2"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </div>
    );
  }
  
  if (notifications.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed rounded-lg">
        <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">No notifications at this time</p>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount} new</Badge>
          )}
        </div>
        
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllAsRead}>
            Mark all as read
          </Button>
        )}
      </div>
      
      <div className="space-y-2">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkRead={handleMarkAsRead}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  );
};

export default Notifications;
