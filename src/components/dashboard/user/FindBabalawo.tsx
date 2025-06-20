
import React, { useEffect, useState } from 'react';
import { Star, Calendar, CheckCircle, MapPin } from 'lucide-react';
import BookSessionModal from "./BookSessionModal";
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface BabalawoProfile {
  id: string;
  full_name?: string;
  avatar_url?: string;
  title?: string;
  specialties?: string[];
  rating?: number;
  reviews?: number;
  verified?: boolean;
  nextAvailable?: string;
  price?: string;
  hourly_rate?: number;
  timezone?: string;
}

const FindBabalawo = () => {
  const [babalawos, setBabalawos] = useState<BabalawoProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingBabalawo, setBookingBabalawo] = useState<BabalawoProfile | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchBabalawos() {
      setLoading(true);
      // Fetch babalawos first
      const { data: babalawosData, error } = await supabase
        .from('babalawos')
        .select(`
          id,
          specialties,
          rating,
          total_sessions,
          verification_status,
          is_active,
          hourly_rate,
          timezone
        `)
        .eq('verification_status', 'approved')
        .eq('is_active', true);

      if (error) {
        console.error('[FindBabalawo] Supabase error:', error);
        setBabalawos([]);
        setLoading(false);
        return;
      }

      if (!babalawosData || babalawosData.length === 0) {
        console.warn('[FindBabalawo] No babalawos data:', babalawosData);
        setBabalawos([]);
        setLoading(false);
        return;
      }

      // Fetch profiles separately
      const babalawoIds = babalawosData.map(b => b.id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', babalawoIds);

      console.log('[FindBabalawo] Loaded babalawos:', babalawosData);

      const mapped = babalawosData.map((b: any) => {
        const profile = profilesData?.find(p => p.id === b.id);
        return {
          id: b.id,
          full_name: profile?.full_name ?? "Babalawo",
          avatar_url: profile?.avatar_url,
          title: "Ifa Priest & Spiritual Guide",
          specialties: Array.isArray(b.specialties) ? b.specialties : [],
          rating: b.rating ? Number(b.rating) : 5,
          reviews: b.total_sessions ?? 0,
          verified: b.verification_status === 'approved',
          nextAvailable: 'Flexible',
          hourly_rate: b.hourly_rate ? Number(b.hourly_rate) : 15000,
          price: b.hourly_rate ? `₦${Number(b.hourly_rate).toLocaleString()}/hr` : '₦15,000/hr',
          timezone: b.timezone || 'UTC',
        };
      });

      setBabalawos(mapped);
      setLoading(false);
    }
    fetchBabalawos();
  }, []);

  const handleViewProfile = (babalawoId: string) => {
    navigate(`/babalawo/${babalawoId}`);
  };

  return (
    <div className="bg-white/50 p-4 sm:p-6 rounded-xl shadow-md">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">Find a Babalawo</h2>
        <p className="text-sm sm:text-base text-gray-600">Connect with verified spiritual guides for personalized consultations</p>
      </div>

      {loading ? (
        <div className="text-gray-500 py-8 text-center">Loading...</div>
      ) : (
        <>
          {babalawos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No Babalawo found at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {babalawos.map((babalawo) => (
                <div key={babalawo.id} className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="text-center mb-4">
                    <div className="relative w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      {babalawo.avatar_url ?
                        <img
                          src={babalawo.avatar_url}
                          alt={babalawo.full_name || 'Babalawo Avatar'}
                          className="w-10 h-10 sm:w-14 sm:h-14 rounded-full object-cover"
                        /> :
                        <span className="text-lg sm:text-2xl font-bold text-primary">
                          {babalawo.full_name?.charAt(0).toUpperCase() || 'B'}
                        </span>
                      }
                      {babalawo.verified && (
                        <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                          <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="mb-1">
                      <h3 className="font-semibold text-sm sm:text-base text-gray-800">{babalawo.full_name}</h3>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500">{babalawo.title}</p>
                    
                    {/* Location/Timezone */}
                    {babalawo.timezone && (
                      <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mt-1">
                        <MapPin className="w-3 h-3" />
                        <span>{babalawo.timezone}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex items-center justify-center mb-2">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`h-3 w-3 sm:h-4 sm:w-4 ${star <= Math.round(babalawo.rating || 0) ? "text-yellow-400 fill-current" : "text-gray-300"}`} />
                        ))}
                        <span className="ml-1 text-xs sm:text-sm text-gray-600">
                          {babalawo.rating?.toFixed(1) || 5.0} ({babalawo.reviews || 0} reviews)
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Specialties:</h4>
                    <div className="flex flex-wrap gap-1">
                      {(babalawo.specialties && babalawo.specialties.length > 0) ? (
                        babalawo.specialties.slice(0, 2).map((specialty, index) => (
                          <span key={index} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                            {specialty}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 text-xs">None listed</span>
                      )}
                      {babalawo.specialties && babalawo.specialties.length > 2 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          +{babalawo.specialties.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center text-xs sm:text-sm text-gray-600">
                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      Next available: {babalawo.nextAvailable}
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-gray-800">
                      ₦{(babalawo.hourly_rate || 15000).toLocaleString()}/session
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <button
                      className="flex-1 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-xs sm:text-sm"
                      onClick={() => setBookingBabalawo(babalawo)}
                      type="button"
                      title="Book session"
                    >
                      Book Now
                    </button>
                    <button 
                      className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm" 
                      type="button" 
                      title="View profile"
                      onClick={() => handleViewProfile(babalawo.id)}
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      
      <BookSessionModal
        open={!!bookingBabalawo}
        onOpenChange={(open) => setBookingBabalawo(open ? bookingBabalawo : null)}
        babalawo={bookingBabalawo}
      />
    </div>
  );
};

export default FindBabalawo;
