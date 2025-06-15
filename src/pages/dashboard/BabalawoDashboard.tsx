
import React from 'react';
import AuthenticatedHeader from '@/components/AuthenticatedHeader';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

const BabalawoDashboard = () => {
  const { userProfile } = useAuth();
  return (
    <div className="flex flex-col min-h-screen">
      <AuthenticatedHeader />
      <main className="flex-grow bg-gradient-to-br from-orange-50 to-pink-50">
        <div className="container mx-auto py-12">
          <h1 className="text-3xl font-semibold text-center text-gray-800 mb-8">
            Babalawo Dashboard
          </h1>
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Welcome, {userProfile?.full_name || 'Babalawo'}!</CardTitle>
              <CardDescription>Manage your profile and sessions.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Your dashboard is under construction. Exciting features are coming soon!</p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BabalawoDashboard;
