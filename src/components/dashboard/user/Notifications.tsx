import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Calendar, MessageSquare, AlertCircle, CheckCircle, Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Notification {
  id: string;
  type: 'session' | 'payment' | 'system' | 'babalawo';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

const Notifications = () => {
  // Mock notifications data
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'session',
      title: 'Upcoming Session Reminder',
      message: 'Your session with Babalawo Adeyemi is scheduled for tomorrow at 2:00 PM.',
      timestamp: '2025-06-20T14:30:00',
      read: false,
      actionUrl: '/sessions/123',
      actionLabel: 'Join Session'
    },
    {
      id: '2',
      type: 'payment',
      title: 'Payment Confirmed',
      message: 'Your payment of ₦15,000 for the session with Babalawo Oluwaseun has been confirmed.',
      timestamp: '2025-06-19T10:15:00',
      read: true
    },
    {
      id: '3',
      type: 'system',
      title: 'New Feature Available',
      message: 'We\'ve added a new Spiritual Journey tracker to help you monitor your progress.',
      timestamp: '2025-06-18T09:00:00',
      read: false,
      actionUrl: '/dashboard/spiritual-journey',
      actionLabel: 'Explore'
    },
    {
      id: '4',
      type: 'babalawo',
      title: 'New Verified Babalawo',
      message: 'Babalawo Temitope, specializing in Love & Relationships, is now available for consultations.',
      timestamp: '2025-06-17T16:45:00',
      read: true,
      actionUrl: '/babalawo/profile/123',
      actionLabel: 'View Profile'
    },
    {
      id: '5',
      type: 'session',
      title: 'Session Rescheduled',
      message: 'Your session with Babalawo Adeyemi has been rescheduled to June 25, 2025 at 3:00 PM.',
      timestamp: '2025-06-16T11:20:00',
      read: true
    }
  ]);

  const [notificationPreferences, setNotificationPreferences] = useState({
    email: true,
    sms: false,
    sessionReminders: true,
    paymentUpdates: true,
    systemAnnouncements: true,
    newBabalawos: false
  });

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(notification => 
      notification.id === id ? { ...notification, read: true } : notification
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(notification => ({ ...notification, read: true })));
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

        <TabsContent value="all" className="space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-500">No notifications</h3>
              <p className="text-gray-400 text-sm">You're all caught up!</p>
            </div>
          ) : (
            notifications.map((notification) => (
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
                            {formatTimestamp(notification.timestamp)}
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
                      {notification.actionUrl && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-1 h-7 text-xs"
                          onClick={() => markAsRead(notification.id)}
                        >
                          {notification.actionLabel || 'View'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          {notifications.filter(n => n.type === 'session').map((notification) => (
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
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(notification.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                    {notification.actionUrl && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-1 h-7 text-xs"
                        onClick={() => markAsRead(notification.id)}
                      >
                        {notification.actionLabel || 'View'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          {notifications.filter(n => n.type === 'payment').map((notification) => (
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
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(notification.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                    {notification.actionUrl && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-1 h-7 text-xs"
                        onClick={() => markAsRead(notification.id)}
                      >
                        {notification.actionLabel || 'View'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          {notifications.filter(n => n.type === 'system' || n.type === 'babalawo').map((notification) => (
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
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(notification.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                    {notification.actionUrl && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-1 h-7 text-xs"
                        onClick={() => markAsRead(notification.id)}
                      >
                        {notification.actionLabel || 'View'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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

                <Button className="w-full">Save Preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Notifications;
