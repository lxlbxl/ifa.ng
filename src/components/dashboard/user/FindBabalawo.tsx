import React, { useEffect, useState } from 'react';
import { Star, Calendar, CheckCircle } from 'lucide-react';
import BookSessionModal from "./BookSessionModal";
import { supabase } from '@/integrations/supabase/client';

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
}

const FindBabalawo = () => {
  const [babalawos, setBabalawos] = useState<BabalawoProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingBabalawo, setBookingBabalawo] = useState<BabalawoProfile | null>(null);

  useEffect(() => {
    async function fetchBabalawos() {
      setLoading(true);
      // ONLY fetch approved & active, no other filter
      const { data, error } = await supabase
        .from('babalawos')
        .select(`
          id,
          specialties,
          rating,
          total_sessions,
          verification_status,
          is_active,
          hourly_rate,
          profiles:profiles(id, full_name, avatar_url, email)
        `)
        .eq('verification_status', 'approved')
        .eq('is_active', true);

      if (error) {
        console.error('[FindBabalawo] Supabase error:', error);
        setBabalawos([]);
        setLoading(false);
        return;
      }
      if (!data || data.length === 0) {
        console.warn('[FindBabalawo] No babalawos data:', data);
      } else {
        console.log('[FindBabalawo] Loaded babalawos:', data);
      }

      const mapped = (data || []).map((b: any) => ({
        id: b.id,
        full_name: b.profiles?.full_name ?? "Unknown",
        avatar_url: b.profiles?.avatar_url,
        title: "Ifa Priest & Spiritual Guide",
        specialties: Array.isArray(b.specialties) ? b.specialties : [],
        rating: b.rating ? Number(b.rating) : 5,
        reviews: b.total_sessions ?? 0,
        verified: b.verification_status === 'approved',
        nextAvailable: 'Flexible',
        price: b.hourly_rate ? `₦${Number(b.hourly_rate).toLocaleString()}/hr` : '₦10,000/hr',
      }));

      setBabalawos(mapped);
      setLoading(false);
    }
    fetchBabalawos();
  }, []);

  return (
    <div className="bg-white/50 p-6 rounded-xl shadow-md">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Find a Babalawo</h2>
        <p className="text-gray-600">Connect with verified spiritual guides for personalized consultations</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {babalawos.map((babalawo) => (
                <div key={babalawo.id} className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      {babalawo.avatar_url ?
                        <img
                          src={babalawo.avatar_url}
                          alt={babalawo.full_name || 'Babalawo Avatar'}
                          className="w-14 h-14 rounded-full object-cover"
                        /> :
                        <span className="text-2xl font-bold text-primary">
                          {babalawo.full_name?.charAt(0).toUpperCase() || 'B'}
                        </span>
                      }
                    </div>
                    <div className="flex items-center justify-center mb-1">
                      <h3 className="font-semibold text-gray-800">{babalawo.full_name}</h3>
                      {babalawo.verified && (
                        <CheckCircle className="h-4 w-4 text-green-500 ml-1" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{babalawo.title}</p>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center justify-center mb-2">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`h-4 w-4 ${star <= Math.round(babalawo.rating || 0) ? "text-yellow-400 fill-current" : "text-gray-300"}`} />
                        ))}
                        <span className="ml-1 text-sm text-gray-600">
                          {babalawo.rating?.toFixed(1) || 5.0} ({babalawo.reviews || 0} reviews)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Specialties:</h4>
                    <div className="flex flex-wrap gap-1">
                      {(babalawo.specialties && babalawo.specialties.length > 0) ? (
                        babalawo.specialties.map((specialty, index) => (
                          <span key={index} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                            {specialty}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 text-xs">None listed</span>
                      )}
                    </div>
                  </div>
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2" />
                      Next available: {babalawo.nextAvailable}
                    </div>
                    <div className="text-sm font-medium text-gray-800">
                      {babalawo.price}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                      onClick={() => setBookingBabalawo(babalawo)}
                      type="button"
                      title="Book session"
                    >
                      Book Now
                    </button>
                    <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors" type="button" title="View profile">
                      View Profile
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {/* Book session modal - controlled by local state */}
      <BookSessionModal
        open={!!bookingBabalawo}
        onOpenChange={(open) => setBookingBabalawo(open ? bookingBabalawo : null)}
        babalawo={bookingBabalawo}
      />
    </div>
  );
};

export default FindBabalawo;
