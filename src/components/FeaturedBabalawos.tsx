
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import BookSessionModal from "./dashboard/user/BookSessionModal";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface BabalawoProfile {
  id: string;
  specialties: string[] | null;
  experience_years: number | null;
  hourly_rate: number | null;
  bio: string | null;
  verification_status: string | null;
  rating: number | null;
  total_sessions: number | null;
  languages: string[] | null;
  timezone: string | null;
  is_active: boolean | null;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

const FeaturedBabalawos: React.FC = () => {
  const [babalawos, setBabalawos] = useState<BabalawoProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingBabalawo, setBookingBabalawo] = useState<any>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchBabalawos = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: babalawosData, error: babalawosError } = await supabase
          .from('babalawos')
          .select(`
            id,
            specialties,
            experience_years,
            hourly_rate,
            bio,
            verification_status,
            rating,
            total_sessions,
            languages,
            timezone,
            is_active
          `)
          .eq('verification_status', 'approved')
          .eq('is_active', true)
          .limit(6);

        if (babalawosError) throw babalawosError;
        if (!babalawosData) {
          setBabalawos([]);
          setLoading(false);
          return;
        }

        // Fetch profiles separately to avoid relationship issues
        const babalawoIds = babalawosData.map(b => b.id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', babalawoIds);

        // Combine the data
        const transformedData: BabalawoProfile[] = babalawosData.map(babalawo => {
          const profile = profilesData?.find(p => p.id === babalawo.id);
          return {
            ...babalawo,
            profiles: profile ? {
              full_name: profile.full_name,
              avatar_url: profile.avatar_url
            } : null
          };
        });
        
        setBabalawos(transformedData);
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchBabalawos();
  }, []);

  const handleBookSession = (babalawo: BabalawoProfile) => {
    if (!user) {
      navigate('/auth?tab=signin');
      return;
    }
    
    // Convert to the format expected by BookSessionModal
    const babalawForModal = {
      id: babalawo.id,
      full_name: babalawo.profiles?.full_name || "Babalawo",
      avatar_url: babalawo.profiles?.avatar_url,
      title: "Ifa Priest & Spiritual Guide",
      specialties: Array.isArray(babalawo.specialties) ? babalawo.specialties : [],
      rating: babalawo.rating ? Number(babalawo.rating) : 5,
      reviews: babalawo.total_sessions ?? 0,
      verified: babalawo.verification_status === 'approved',
      nextAvailable: 'Flexible',
      hourly_rate: babalawo.hourly_rate ? Number(babalawo.hourly_rate) : 15000,
      price: babalawo.hourly_rate ? `₦${Number(babalawo.hourly_rate).toLocaleString()}/hr` : '₦15,000/hr',
    };
    
    setBookingBabalawo(babalawForModal);
  };

  if (loading) {
    return <div className="text-center">Loading babalawos...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">Error: {error}</div>;
  }

  if (babalawos.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No verified babalawos available at the moment.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {babalawos.map((babalawo) => (
          <div
            key={babalawo.id}
            className="bg-white rounded-xl shadow-md p-4 sm:p-5 flex flex-col items-center text-center fade-in"
          >
            {/* Avatar */}
            <Avatar className="w-16 h-16 sm:w-20 sm:h-20 mb-3 border-2 border-primary">
              {babalawo.profiles?.avatar_url ? (
                <AvatarImage
                  src={babalawo.profiles.avatar_url}
                  alt={babalawo.profiles.full_name || "Babalawo"}
                />
              ) : (
                <AvatarFallback className="text-lg sm:text-xl">
                  {babalawo.profiles?.full_name
                    ? babalawo.profiles.full_name.charAt(0).toUpperCase()
                    : "B"}
                </AvatarFallback>
              )}
            </Avatar>
            {/* Name */}
            <div className="font-semibold text-base sm:text-lg text-gray-900 mb-1 text-center">
              {babalawo.profiles?.full_name || "Babalawo"}
            </div>
            {/* Rating and Sessions */}
            <div className="text-xs sm:text-sm text-gray-600 mb-2">
              ⭐ {babalawo.rating || 0} • {babalawo.total_sessions || 0} sessions
            </div>
            {/* Specialties */}
            {babalawo.specialties && babalawo.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3 justify-center">
                {babalawo.specialties.slice(0, 2).map((specialty, index) => (
                  <span key={index} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                    {specialty}
                  </span>
                ))}
              </div>
            )}
            {/* Price */}
            <div className="text-sm font-semibold text-gray-800 mb-3">
              ₦{(babalawo.hourly_rate || 15000).toLocaleString()}/session
            </div>
            {/* Action Button */}
            <button 
              className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors text-sm sm:text-base"
              onClick={() => handleBookSession(babalawo)}
            >
              Book Session
            </button>
          </div>
        ))}
      </div>
      
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
