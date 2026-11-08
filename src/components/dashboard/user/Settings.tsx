
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
    <div className="bg-white/50 p-6 rounded-xl shadow-md">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Settings</h2>

      <div className="space-y-8">
        {/* Profile Settings */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-4">
            <User className="h-5 w-5 text-primary mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Profile Information</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                defaultValue={userProfile?.full_name || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                defaultValue={userProfile?.email || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                placeholder="+1 (555) 123-4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary">
                <option>Eastern Time (ET)</option>
                <option>Central Time (CT)</option>
                <option>Mountain Time (MT)</option>
                <option>Pacific Time (PT)</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Spiritual Interests</label>
            <div className="flex flex-wrap gap-2">
              {['Love & Relationships', 'Career & Money', 'Health & Healing', 'Spiritual Growth', 'Family Matters'].map((interest) => (
                <button key={interest} className="px-3 py-1 border border-gray-300 text-gray-700 rounded-full hover:bg-primary/10 hover:border-primary transition-colors">
                  {interest}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <button className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
              Save Changes
            </button>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-4">
            <Bell className="h-5 w-5 text-primary mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Notification Preferences</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-800">Email Notifications</h4>
                <p className="text-sm text-gray-600">Receive updates via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.email}
                  onChange={(e) => setNotifications({...notifications, email: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-800">SMS Notifications</h4>
                <p className="text-sm text-gray-600">Receive text message alerts</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.sms}
                  onChange={(e) => setNotifications({...notifications, sms: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-800">Session Reminders</h4>
                <p className="text-sm text-gray-600">Get reminded before your sessions</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.sessionReminders}
                  onChange={(e) => setNotifications({...notifications, sessionReminders: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Privacy & Security */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-4">
            <Shield className="h-5 w-5 text-primary mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Privacy & Security</h3>
          </div>

          <div className="space-y-4">
            <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <h4 className="font-medium text-gray-800">Change Password</h4>
              <p className="text-sm text-gray-600">Update your account password</p>
            </button>

            <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <h4 className="font-medium text-gray-800">Two-Factor Authentication</h4>
              <p className="text-sm text-gray-600">Add an extra layer of security</p>
            </button>

            <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <h4 className="font-medium text-gray-800">Privacy Settings</h4>
              <p className="text-sm text-gray-600">Control your data and visibility</p>
            </button>
          </div>
        </div>

        {/* Payment Settings */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-4">
            <CreditCard className="h-5 w-5 text-primary mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Payment & Billing</h3>
          </div>

          <div className="space-y-4">
            <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <h4 className="font-medium text-gray-800">Payment Methods</h4>
              <p className="text-sm text-gray-600">Manage your saved payment methods</p>
            </button>

            <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <h4 className="font-medium text-gray-800">Billing History</h4>
              <p className="text-sm text-gray-600">View your payment history and invoices</p>
            </button>

            <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <h4 className="font-medium text-gray-800">Wallet Balance</h4>
              <p className="text-sm text-gray-600">Add funds to your account</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
