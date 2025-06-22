
import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import BookSessionModal from "./dashboard/user/BookSessionModal";
import BabalawoGrid from "./babalawo/BabalawoGrid";
import { useBabalawos } from '@/hooks/useBabalawos';

const FeaturedBabalawos: React.FC = () => {
  const { babalawos, loading, error } = useBabalawos();
  const [bookingBabalawo, setBookingBabalawo] = useState<any>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

    const handleBookSession = (babalawo: any) => {
      if (!user) {
        navigate('/auth?tab=signin');
        return;
      }
      
      // Convert to the format expected by BookSessionModal
      const babalawForModal = {
        id: babalawo.id,
        full_name: babalawo.full_name || "Babalawo",
        avatar_url: babalawo.avatar_url,
        title: "Ifa Priest & Spiritual Guide",
        specialties: Array.isArray(babalawo.specialties) ? babalawo.specialties : [],
        rating: babalawo.rating ? Number(babalawo.rating) : 5,
        reviews: babalawo.total_sessions ?? 0,
        // verified field removed as it's not in the type
        nextAvailable: 'Flexible',
        hourly_rate: babalawo.hourly_rate ? Number(babalawo.hourly_rate) : 15000,
        price: babalawo.hourly_rate ? `₦${Number(babalawo.hourly_rate).toLocaleString()}/hr` : '₦15,000/hr',
      };
      
      setBookingBabalawo(babalawForModal);
    };

  const handleViewProfile = (babalawoId: string) => {
    navigate(`/babalawo/${babalawoId}`);
  };

  if (loading) {
    return <div className="text-center">Loading babalawos...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">Error: {error}</div>;
  }

  return (
    <>
      <BabalawoGrid
        babalawos={babalawos}
        onBookSession={handleBookSession}
        onViewProfile={handleViewProfile}
      />
      
      {/* Book session modal */}
      <BookSessionModal
        open={!!bookingBabalawo}
        onOpenChange={(open) => setBookingBabalawo(open ? bookingBabalawo : null)}
        babalawo={bookingBabalawo}
      />
    </>
  );
};

export default FeaturedBabalawos;
