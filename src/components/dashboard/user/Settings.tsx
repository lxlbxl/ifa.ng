
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Bell, Shield, CreditCard, Globe, User, Mail, Phone } from 'lucide-react';

const Settings = () => {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    sessionReminders: true,
    promotions: false
  });

  return (
    <div>

      <div className="space-y-8">
        {/* Profile Settings */}
        <div className="rounded-panel border border-line bg-paper p-5 sm:p-6">
          <div className="flex items-center mb-4">
            <User className="h-5 w-5 text-primary mr-2" />
            <h3 className="text-lg font-semibold text-ink">Profile Information</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Full Name</label>
              <input
                type="text"
                defaultValue={userProfile?.full_name || ''}
                className="h-12 w-full rounded-field border border-input bg-paper px-4 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Email</label>
              <input
                type="email"
                defaultValue={userProfile?.email || ''}
                className="h-12 w-full rounded-field border border-input bg-paper px-4 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Phone Number</label>
              <input
                type="tel"
                placeholder="+234 803 000 0000"
                className="h-12 w-full rounded-field border border-input bg-paper px-4 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Timezone</label>
              <select className="h-12 w-full rounded-field border border-input bg-paper px-4 focus:outline-none focus:ring-2 focus:ring-ring">
                <option>West Africa (Lagos)</option>
                <option>United Kingdom (London)</option>
                <option>United States, East (New York)</option>
                <option>Brazil (São Paulo)</option>
                <option>Cuba (Havana)</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-ink mb-2">Spiritual Interests</label>
            <div className="flex flex-wrap gap-2">
              {['Love & Relationships', 'Career & Money', 'Health & Healing', 'Spiritual Growth', 'Family Matters'].map((interest) => (
                <button key={interest} className="rounded-pill border-2 border-line bg-paper px-4 py-1.5 text-sm font-semibold text-ink hover:border-ink transition-colors">
                  {interest}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <button className="h-11 rounded-pill bg-ink px-6 text-sm font-bold text-cloth transition-transform hover:-translate-y-0.5">
              Save Changes
            </button>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="rounded-panel border border-line bg-paper p-5 sm:p-6">
          <div className="flex items-center mb-4">
            <Bell className="h-5 w-5 text-primary mr-2" />
            <h3 className="text-lg font-semibold text-ink">Notification Preferences</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-ink">Email Notifications</h4>
                <p className="text-sm text-muted-foreground">Receive updates via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.email}
                  onChange={(e) => setNotifications({...notifications, email: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-line peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-paper after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-ink">SMS Notifications</h4>
                <p className="text-sm text-muted-foreground">Receive text message alerts</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.sms}
                  onChange={(e) => setNotifications({...notifications, sms: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-line peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-paper after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-ink">Session Reminders</h4>
                <p className="text-sm text-muted-foreground">Get reminded before your sessions</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.sessionReminders}
                  onChange={(e) => setNotifications({...notifications, sessionReminders: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-line peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-paper after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Privacy & Security */}
        <div className="rounded-panel border border-line bg-paper p-5 sm:p-6">
          <div className="flex items-center mb-4">
            <Shield className="h-5 w-5 text-primary mr-2" />
            <h3 className="text-lg font-semibold text-ink">Privacy & Security</h3>
          </div>

          <div className="space-y-4">
            <button className="w-full text-left px-4 py-3 border border-line rounded-lg hover:bg-cloth transition-colors">
              <h4 className="font-medium text-ink">Change Password</h4>
              <p className="text-sm text-muted-foreground">Update your account password</p>
            </button>

            <button className="w-full text-left px-4 py-3 border border-line rounded-lg hover:bg-cloth transition-colors">
              <h4 className="font-medium text-ink">Two-Factor Authentication</h4>
              <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
            </button>

            <button className="w-full text-left px-4 py-3 border border-line rounded-lg hover:bg-cloth transition-colors">
              <h4 className="font-medium text-ink">Privacy Settings</h4>
              <p className="text-sm text-muted-foreground">Control your data and visibility</p>
            </button>
          </div>
        </div>

        {/* Payment Settings */}
        <div className="rounded-panel border border-line bg-paper p-5 sm:p-6">
          <div className="flex items-center mb-4">
            <CreditCard className="h-5 w-5 text-primary mr-2" />
            <h3 className="text-lg font-semibold text-ink">Payment & Billing</h3>
          </div>

          <div className="space-y-4">
            <button className="w-full text-left px-4 py-3 border border-line rounded-lg hover:bg-cloth transition-colors">
              <h4 className="font-medium text-ink">Payment Methods</h4>
              <p className="text-sm text-muted-foreground">Manage your saved payment methods</p>
            </button>

            <button className="w-full text-left px-4 py-3 border border-line rounded-lg hover:bg-cloth transition-colors">
              <h4 className="font-medium text-ink">Billing History</h4>
              <p className="text-sm text-muted-foreground">View your payment history and invoices</p>
            </button>

            <button className="w-full text-left px-4 py-3 border border-line rounded-lg hover:bg-cloth transition-colors">
              <h4 className="font-medium text-ink">Wallet Balance</h4>
              <p className="text-sm text-muted-foreground">Add funds to your account</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
