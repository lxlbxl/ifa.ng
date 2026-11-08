import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import BookSessionModal from "./dashboard/user/BookSessionModal";
import BabalawoGrid from "./babalawo/BabalawoGrid";
import { useFeaturedBabalawos } from '@/hooks/useBabalawoSearch';
import { BabalawoProfile } from '@/types/babalawo';
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const FeaturedBabalawos: React.FC = () => {
  const { featuredBabalawos: babalawos, loading, error } = useFeaturedBabalawos(6);
  const [bookingBabalawo, setBookingBabalawo] = useState<BabalawoProfile | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBookSession = (babalawo: BabalawoProfile) => {
    if (!user) {
      navigate('/auth?tab=signin');
      return;
    }
    
    // Convert to the format expected by BookSessionModal
    const babalawoForModal: BabalawoProfile = {
      id: babalawo.id,
      full_name: babalawo.full_name || "Babalawo",
      avatar_url: babalawo.avatar_url,
      specialties: Array.isArray(babalawo.specialties) ? babalawo.specialties : [],
      experience_years: babalawo.experience_years,
      hourly_rate: babalawo.hourly_rate ? Number(babalawo.hourly_rate) : 15000,
      bio: babalawo.bio,
      verification_status: babalawo.verification_status,
      rating: babalawo.rating ? Number(babalawo.rating) : 5,
      total_sessions: babalawo.total_sessions ?? 0,
      languages: babalawo.languages,
      timezone: babalawo.timezone,
      is_active: babalawo.is_active,
    };
    
    setBookingBabalawo(babalawoForModal);
  };

  const handleViewProfile = (babalawoId: string) => {
    navigate(`/babalawo/${babalawoId}`);
  };

  const handleBrowseAll = () => {
    navigate('/dashboard?view=babalawos');
  };

  // Loading state with skeleton
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-center mb-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
          <h2 className="text-2xl font-semibold text-gray-700">Loading Featured Babalawos</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <Card key={index} className="rounded-xl shadow-md animate-pulse">
              <CardContent className="p-6 flex flex-col items-center">
                <div className="w-20 h-20 bg-gray-200 rounded-full mb-4"></div>
                <div className="w-3/4 h-5 bg-gray-200 rounded mb-2"></div>
                <div className="w-1/2 h-4 bg-gray-200 rounded mb-4"></div>
                <div className="w-full h-10 bg-gray-200 rounded mb-2"></div>
                <div className="w-full h-10 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state with retry button
  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-lg mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Unable to Load Babalawos</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button 
              onClick={() => window.location.reload()} 
              className="mx-auto flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state with CTA
  if (!babalawos || babalawos.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-lg mx-auto">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Featured Babalawos Available</h3>
            <p className="text-gray-600 mb-6">
              We're currently updating our featured Babalawos. Please check back soon or browse all available Babalawos.
            </p>
            <Button 
              onClick={handleBrowseAll} 
              className="mx-auto"
            >
              Browse All Babalawos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Featured Spiritual Guides</h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Connect with our most experienced and highly-rated Babalawos for authentic spiritual guidance
        </p>
      </div>
      
      <BabalawoGrid
        babalawos={babalawos}
        onBookSession={handleBookSession}
        onViewProfile={handleViewProfile}
      />
      
      <div className="mt-12 text-center">
        <Button 
          onClick={handleBrowseAll}
          variant="outline" 
          size="lg"
          className="border-primary text-primary hover:bg-primary hover:text-white"
        >
          Browse All Babalawos
        </Button>
      </div>
      
      {/* Book session modal */}
      <BookSessionModal
        open={!!bookingBabalawo}
        onOpenChange={(open) => setBookingBabalawo(open ? bookingBabalawo : null)}
        babalawo={bookingBabalawo}
      />
    </div>
  );
};

export default FeaturedBabalawos;