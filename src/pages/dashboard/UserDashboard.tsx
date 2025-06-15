
import React from 'react';
import FeaturedBabalawos from '@/components/FeaturedBabalawos';
import AuthenticatedHeader from '@/components/AuthenticatedHeader';
import Footer from '@/components/Footer';

const UserDashboard = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <AuthenticatedHeader />
      <main className="flex-grow bg-gradient-to-br from-orange-50 to-pink-50">
        <FeaturedBabalawos />
      </main>
      <Footer />
    </div>
  );
};

export default UserDashboard;
