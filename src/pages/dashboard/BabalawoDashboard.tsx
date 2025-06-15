
import React from 'react';
import AuthenticatedHeader from '@/components/AuthenticatedHeader';
import Footer from '@/components/Footer';
import BabalawoDashboardOverview from '@/components/dashboard/babalawo/BabalawoDashboardOverview';

const BabalawoDashboard = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <AuthenticatedHeader />
      <main className="flex-grow bg-gradient-to-br from-orange-50 to-pink-50">
        <div className="container mx-auto py-8">
          <h1 className="text-3xl font-semibold text-center text-gray-800 mb-8">
            Babalawo Dashboard
          </h1>
          <BabalawoDashboardOverview />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BabalawoDashboard;
