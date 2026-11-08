
import React from 'react';
import { Star, Calendar, CheckCircle, MapPin } from 'lucide-react';
import { useConsultFlow } from "@/components/flow/ConsultFlow";
import { useBabalawos } from '@/hooks/useBabalawos';
import { useNavigate } from 'react-router-dom';

const FindBabalawo = () => {
  const { babalawos, loading, error } = useBabalawos();
  const { openConsult } = useConsultFlow();
  const navigate = useNavigate();

  const handleViewProfile = (babalawoId: string) => {
    if (!babalawoId) {
      console.warn('[FindBabalawo] Invalid babalawoId for profile navigation:', babalawoId);
      return;
    }
    navigate(`/babalawo/${babalawoId}`);
  };

  if (loading) {
    return <div className="text-gray-500 py-8 text-center">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500 py-8 text-center">Error loading babalawos: {error}</div>;
  }

  if (!babalawos || babalawos.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No Babalawo found at the moment.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/50 p-4 sm:p-6 rounded-xl shadow-md">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">Find a Babalawo</h2>
        <p className="text-sm sm:text-base text-gray-600">Connect with verified spiritual guides for personalized consultations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {babalawos.map((babalawo) => (
          <div key={babalawo.id} className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="text-center mb-4">
              <div className="relative w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                {babalawo.avatar_url ? (
                  <img
                    src={babalawo.avatar_url}
                    alt={babalawo.full_name || 'Babalawo Avatar'}
                    className="w-10 h-10 sm:w-14 sm:h-14 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-lg sm:text-2xl font-bold text-primary">
                    {babalawo.full_name?.charAt(0).toUpperCase() || 'B'}
                  </span>
                )}
                {/* Remove verified check since 'verified' is not in BabalawoProfile type */}
                {/* {babalawo.verified && (
                  <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                  </div>
                )} */}
              </div>
              <div className="mb-1">
                <h3 className="font-semibold text-sm sm:text-base text-gray-800">{babalawo.full_name}</h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">Ifa Priest & Spiritual Guide</p>
              
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
                    {babalawo.rating?.toFixed(1) || 5.0} ({babalawo.total_sessions || 0} reviews)
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mb-4 space-y-2">
              <div className="flex items-center text-xs sm:text-sm text-gray-600">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                Next available: Flexible
              </div>
              <div className="text-xs sm:text-sm font-medium text-gray-800">
                ₦{(babalawo.hourly_rate || 15000).toLocaleString()}/session
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <button
                className="flex-1 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-xs sm:text-sm"
                onClick={() => openConsult(babalawo)}
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

    </div>
  );
};

export default FindBabalawo;
