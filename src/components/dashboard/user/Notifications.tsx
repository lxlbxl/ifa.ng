import React, { useState, useEffect, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Calendar, MessageSquare, AlertCircle, CheckCircle, Clock, User, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  type: 'session' | 'payment' | 'system' | 'babalawo' | 'reminder' | 'warning';
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  action_url?: string;
  action_label?: string;
  recipient_id: string;
}

interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  sessionReminders: boolean;
  paymentUpdates: boolean;
  systemAnnouncements: boolean;
  newBabalawos: boolean;
}

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    email: true,
    sms: false,
    sessionReminders: true,
    paymentUpdates: true,
    systemAnnouncements: true,
    newBabalawos: false
  });

  // Fetch notifications from the database
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchNotifications = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        setNotifications(data || []);
      } catch (err: any) {
        console.error('Error fetching notifications:', err);
        setError('Failed to load notifications. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchNotifications();
    
    // Set up real-time subscription for new notifications
    const subscription = supabase
      .channel('notifications-changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `recipient_id=eq.${user.id}`
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // Fetch notification preferences
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
          setNotificationPreferences({
            email: data.email_enabled,
            sms: data.sms_enabled,
            sessionReminders: data.session_reminders,
            paymentUpdates: data.payment_updates,
            systemAnnouncements: data.system_announcements,
            newBabalawos: data.new_babalawos
          });
        }
      } catch (err) {
        console.error('Error fetching notification preferences:', err);
      }
    };
    
    fetchPreferences();
  }, [user?.id]);

  const markAsRead = async (id: string) => {
    try {
      // Update locally first for immediate UI feedback
      setNotifications(notifications.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      ));
      
      // Then update in the database
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      
      if (error) throw error;
    } catch (err) {
      console.error('Error marking notification as read:', err);
      toast({ 
        title: 'Error',
        description: 'Failed to mark notification as read',
        variant: 'destructive'
      });
    }
  };

  const markAllAsRead = async () => {
    try {
      // Update locally first
      setNotifications(notifications.map(notification => ({ ...notification, read: true })));
      
      // Then update in the database
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('recipient_id', user?.id)
        .eq('read', false);
      
      if (error) throw error;
      
      toast({ title: 'All notifications marked as read' });
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      toast({ 
        title: 'Error',
        description: 'Failed to mark all notifications as read',
        variant: 'destructive'
      });
    }
  };

  const savePreferences = async () => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          email_enabled: notificationPreferences.email,
          sms_enabled: notificationPreferences.sms,
          session_reminders: notificationPreferences.sessionReminders,
          payment_updates: notificationPreferences.paymentUpdates,
          system_announcements: notificationPreferences.systemAnnouncements,
          new_babalawos: notificationPreferences.newBabalawos
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
      
      toast({ title: 'Notification preferences saved' });
    } catch (err) {
      console.error('Error saving notification preferences:', err);
      toast({ 
        title: 'Error',
        description: 'Failed to save notification preferences',
        variant: 'destructive'
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'session':
        return <Calendar className="h-5 w-5 text-blue-500" />;
      case 'payment':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'system':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'babalawo':
        return <User className="h-5 w-5 text-purple-500" />;
      case 'reminder':
        return <Clock className="h-5 w-5 text-indigo-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderNotificationCard = (notification: Notification) => (
    <Card key={notification.id} className={`border-l-4 ${notification.read ? 'border-l-gray-200' : 'border-l-primary'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className={`font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                {notification.title}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatTimestamp(notification.created_at)}
                </span>
                {!notification.read && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-xs"
                    onClick={() => markAsRead(notification.id)}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
            {notification.action_url && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-1 h-7 text-xs"
                onClick={() => {
                  markAsRead(notification.id);
                  window.open(notification.action_url, '_blank');
                }}
              >
                {notification.action_label || 'View'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="bg-white/50 p-6 rounded-xl shadow-md">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold text-gray-800">Notifications</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount} new
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            Mark all as read
          </Button>
        )}
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid grid-cols-5 mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-3" />
            <h3 className="text-lg font-medium">{error}</h3>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        ) : (
          <>
            <TabsContent value="all" className="space-y-4">
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-500">No notifications</h3>
                  <p className="text-gray-400 text-sm">You're all caught up!</p>
                </div>
              ) : (
                notifications.map(renderNotificationCard)
              )}
            </TabsContent>

            <TabsContent value="sessions" className="space-y-4">
              {notifications.filter(n => n.type === 'session').length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-500">No session notifications</h3>
                </div>
              ) : (
                notifications.filter(n => n.type === 'session').map(renderNotificationCard)
              )}
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              {notifications.filter(n => n.type === 'payment').length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-500">No payment notifications</h3>
                </div>
              ) : (
                notifications.filter(n => n.type === 'payment').map(renderNotificationCard)
              )}
            </TabsContent>

            <TabsContent value="system" className="space-y-4">
              {notifications.filter(n => ['system', 'babalawo', 'reminder', 'warning'].includes(n.type)).length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-500">No system notifications</h3>
                </div>
              ) : (
                notifications.filter(n => ['system', 'babalawo', 'reminder', 'warning'].includes(n.type)).map(renderNotificationCard)
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="font-medium text-gray-700">Delivery Methods</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-gray-500" />
                            <Label htmlFor="email-notifications">Email Notifications</Label>
                          </div>
                          <Switch 
                            id="email-notifications" 
                            checked={notificationPreferences.email}
                            onCheckedChange={(checked) => setNotificationPreferences({...notificationPreferences, email: checked})}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-gray-500" />
                            <Label htmlFor="sms-notifications">SMS Notifications</Label>
                          </div>
                          <Switch 
                            id="sms-notifications" 
                            checked={notificationPreferences.sms}
                            onCheckedChange={(checked) => setNotificationPreferences({...notificationPreferences, sms: checked})}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-medium text-gray-700">Notification Types</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-500" />
                            <Label htmlFor="session-reminders">Session Reminders</Label>
                          </div>
                          <Switch 
                            id="session-reminders" 
                            checked={notificationPreferences.sessionReminders}
                            onCheckedChange={(checked) => setNotificationPreferences({...notificationPreferences, sessionReminders: checked})}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <Label htmlFor="payment-updates">Payment Updates</Label>
                          </div>
                          <Switch 
                            id="payment-updates" 
                            checked={notificationPreferences.paymentUpdates}
                            onCheckedChange={(checked) => setNotificationPreferences({...notificationPreferences, paymentUpdates: checked})}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-orange-500" />
                            <Label htmlFor="system-announcements">System Announcements</Label>
  const renderNotificationCard = (notification: Notification) => (
    <Card key={notification.id} className={`border-l-4 ${notification.read ? 'border-l-gray-200' : 'border-l-primary'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className={`font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                {notification.title}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatTimestamp(notification.created_at)}
                </span>
                {!notification.read && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-xs"
                    onClick={() => markAsRead(notification.id)}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
            {notification.action_url && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-1 h-7 text-xs"
                onClick={() => {
                  markAsRead(notification.id);
                  window.open(notification.action_url, '_blank');
                }}
              >
                {notification.action_label || 'View'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="bg-white/50 p-6 rounded-xl shadow-md">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold text-gray-800">Notifications</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount} new
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            Mark all as read
          </Button>
        )}
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid grid-cols-5 mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-3" />
            <h3 className="text-lg font-medium">{error}</h3>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        ) : (
          <>
            <TabsContent value="all" className="space-y-4">
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-500">No notifications</h3>
                  <p className="text-gray-400 text-sm">You're all caught up!</p>
                </div>
              ) : (
                notifications.map(renderNotificationCard)
              )}
            </TabsContent>

            <TabsContent value="sessions" className="space-y-4">
              {notifications.filter(n => n.type === 'session').length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-500">No session notifications</h3>
                </div>
              ) : (
                notifications.filter(n => n.type === 'session').map(renderNotificationCard)
              )}
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              {notifications.filter(n => n.type === 'payment').length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-500">No payment notifications</h3>
                </div>
              ) : (
                notifications.filter(n => n.type === 'payment').map(renderNotificationCard)
              )}
            </TabsContent>

            <TabsContent value="system" className="space-y-4">
              {notifications.filter(n => ['system', 'babalawo', 'reminder', 'warning'].includes(n.type)).length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-500">No system notifications</h3>
                </div>
              ) : (
                notifications.filter(n => ['system', 'babalawo', 'reminder', 'warning'].includes(n.type)).map(renderNotificationCard)
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="font-medium text-gray-700">Delivery Methods</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-gray-500" />
                            <Label htmlFor="email-notifications">Email Notifications</Label>
                          </div>
                          <Switch 
                            id="email-notifications" 
                            checked={notificationPreferences.email}
                            onCheckedChange={(checked) => setNotificationPreferences({...notificationPreferences, email: checked})}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-gray-500" />
                            <Label htmlFor="sms-notifications">SMS Notifications</Label>
                          </div>
                          <Switch 
                            id="sms-notifications" 
                            checked={notificationPreferences.sms}
                            onCheckedChange={(checked) => setNotificationPreferences({...notificationPreferences, sms: checked})}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-medium text-gray-700">Notification Types</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-500" />
                            <Label htmlFor="session-reminders">Session Reminders</Label>
                          </div>
                          <Switch 
                            id="session-reminders" 
                            checked={notificationPreferences.sessionReminders}
                            onCheckedChange={(checked) => setNotificationPreferences({...notificationPreferences, sessionReminders: checked})}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <Label htmlFor="payment-updates">Payment Updates</Label>
                          </div>
                          <Switch 
                            id="payment-updates" 
                            checked={notificationPreferences.paymentUpdates}
                            onCheckedChange={(checked) => setNotificationPreferences({...notificationPreferences, paymentUpdates: checked})}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-orange-500" />
                            <Label htmlFor="system-announcements">System Announcements</Label>
                          </div>
                          <Switch 
                            id="system-announcements" 
                            checked={notificationPreferences.systemAnnouncements}
                            onCheckedChange={(checked) => setNotificationPreferences({...notificationPreferences, systemAnnouncements: checked})}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-purple-500" />
                            <Label htmlFor="new-babalawos">New Verified Babalawos</Label>
                          </div>
                          <Switch 
                            id="new-babalawos" 
                            checked={notificationPreferences.newBabalawos}
                            onCheckedChange={(checked) => setNotificationPreferences({...notificationPreferences, newBabalawos: checked})}
                          />
                        </div>
                      </div>
                    </div>

                    <Button className="w-full" onClick={savePreferences}>Save Preferences</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}                        </div>
                          <Switch 
                            id="system-announcements" 
                            checked={notificationPreferences.systemAnnouncements}
                            onCheckedChange={(checked) => setNotificationPreferences({...notificationPreferences, systemAnnouncements: checked})}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-purple-500" />
                            <Label htmlFor="new-babalawos">New Verified Babalawos</Label>
                          </div>
                          <Switch 
                            id="new-babalawos" 
                            checked={notificationPreferences.newBabalawos}
                            onCheckedChange={(checked) => setNotificationPreferences({...notificationPreferences, newBabalawos: checked})}
                          />
                        </div>
                      </div>
                    </div>

                    <Button className="w-full" onClick={savePreferences}>Save Preferences</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};

export default Notifications;
