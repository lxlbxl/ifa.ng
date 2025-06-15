
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

        // Fetch profiles for each babalawo
        const babalawosWithProfiles = await Promise.all(
          babalawosData.map(async (babalawo) => {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('id', babalawo.id)
              .single();

            if (profileError) {
              console.error('Error fetching profile:', profileError);
              return { ...babalawo, profiles: null };
            }

            return { ...babalawo, profiles: profileData };
          })
        );
        
        setBabalawos(babalawosWithProfiles);
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchBabalawos();
  }, []);

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {babalawos.map((babalawo) => (
        <div
          key={babalawo.id}
          className="bg-white rounded-xl shadow-md p-5 flex flex-col items-center text-center fade-in"
        >
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full overflow-hidden mb-3 border-2 border-primary">
            {babalawo.profiles?.avatar_url ? (
              <img
                src={babalawo.profiles.avatar_url}
                alt={babalawo.profiles.full_name ?? "Babalawo"}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="w-full h-full flex items-center justify-center bg-slate-200 text-4xl font-bold text-primary">
                {babalawo.profiles?.full_name
                  ? babalawo.profiles.full_name.charAt(0)
                  : "B"}
              </span>
            )}
          </div>
          {/* Name */}
          <div className="font-semibold text-lg text-gray-900 mb-1">
            {babalawo.profiles?.full_name ?? "Unknown"}
          </div>
          {/* Rating and Sessions */}
          <div className="text-sm text-gray-600 mb-2">
            ⭐ {babalawo.rating || 0} • {babalawo.total_sessions || 0} sessions
          </div>
          {/* Specialties */}
          {babalawo.specialties && babalawo.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {babalawo.specialties.slice(0, 2).map((specialty, index) => (
                <span key={index} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                  {specialty}
                </span>
              ))}
            </div>
          )}
          {/* Price */}
          <div className="text-sm font-semibold text-gray-800 mb-3">
            ${babalawo.hourly_rate || 0}/session
          </div>
          {/* Action Button */}
          <button className="w-full bg-primary text-white py-2 rounded-lg hover:bg-primary/90 transition-colors">
            Book Session
          </button>
        </div>
      ))}
    </div>
  );
};

export default FeaturedBabalawos;
