
import React from 'react';
import { Card } from '@/components/ui/card';
import DashboardOverview from '@/components/dashboard/admin/DashboardOverview';
import UserManagement from '@/components/dashboard/admin/UserManagement';
import BabalawoManagement from '@/components/dashboard/admin/BabalawoManagement';
import PaymentsFinancePanel from "@/components/dashboard/admin/PaymentsFinancePanel";
import AdminSettingsPanel from "@/components/dashboard/admin/AdminSettingsPanel";

type Section = 'overview' | 'users' | 'babalawos' | 'finance' | 'settings';

const SECTION_MAP: { [key in Section]: React.ReactNode } = {
  overview: <DashboardOverview />,
  users: <UserManagement />,
  babalawos: <BabalawoManagement />,
  finance: <PaymentsFinancePanel />,
  settings: <AdminSettingsPanel />,
};

interface Props {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
}

const AdminSectionTabs: React.FC<Props> = ({ activeSection, onSectionChange }) => (
  <div className="mb-8">
    <Card className="p-0 overflow-hidden border-0 bg-transparent shadow-none">
      <div className="flex space-x-1 border-b border-[#e7e7ef] bg-transparent">
        <button
          className={`flex-1 py-3 font-semibold text-sm transition-colors
            ${activeSection === 'overview'
              ? 'border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50'
              : 'text-gray-600 hover:bg-gray-100'}`}
          onClick={() => onSectionChange('overview')}
        >Overview</button>
        <button
          className={`flex-1 py-3 font-semibold text-sm transition-colors
            ${activeSection === 'users'
              ? 'border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50'
              : 'text-gray-600 hover:bg-gray-100'}`}
          onClick={() => onSectionChange('users')}
        >Users</button>
        <button
          className={`flex-1 py-3 font-semibold text-sm transition-colors
            ${activeSection === 'babalawos'
              ? 'border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50'
              : 'text-gray-600 hover:bg-gray-100'}`}
          onClick={() => onSectionChange('babalawos')}
        >Babalawos</button>
        <button
          className={`flex-1 py-3 font-semibold text-sm transition-colors
            ${activeSection === 'finance'
              ? 'border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50'
              : 'text-gray-600 hover:bg-gray-100'}`}
          onClick={() => onSectionChange('finance')}
        >Finance</button>
        <button
          className={`flex-1 py-3 font-semibold text-sm transition-colors
            ${activeSection === 'settings'
              ? 'border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50'
              : 'text-gray-600 hover:bg-gray-100'}`}
          onClick={() => onSectionChange('settings')}
        >Settings</button>
      </div>
      <div className="p-0 pt-6">
        {SECTION_MAP[activeSection]}
      </div>
    </Card>
  </div>
);

export default AdminSectionTabs;
