
import React, { useEffect, useState } from 'react';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Babalawo = Database['public']['Tables']['babalawos']['Row'] & {
  profiles: Profile | null;
};

const FeaturedBabalawos: React.FC = () => {
  const [babalawos, setBabalawos] = useState<Babalawo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBabalawos = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: babalawosData, error: babalawosError } = await supabase
          .from('babalawos')
          .select('*');

        if (babalawosError) throw babalawosError;
        if (!babalawosData) {
          setBabalawos([]);
          setLoading(false);
          return;
        }

        const profileIds = babalawosData.map((b) => b.id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', profileIds);

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profilesData?.map((p) => [p.id, p]));

        const combinedData = babalawosData.map((babalawo) => ({
          ...babalawo,
          profiles: profilesMap.get(babalawo.id) ?? null,
        }));
        
        setBabalawos(combinedData);
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

  return (
    <div className="container mx-auto py-12">
      <h2 className="text-3xl font-semibold text-center text-gray-800 mb-8">
        Featured Babalawos
      </h2>
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
            {/* Additional info like rating, experience, etc can go here */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeaturedBabalawos;
