
import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle, MapPin } from 'lucide-react';

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

interface BabalawoCardProps {
  babalawo: BabalawoProfile;
  onBookSession: (babalawo: BabalawoProfile) => void;
  onViewProfile: (babalawoId: string) => void;
}

const BabalawoCard: React.FC<BabalawoCardProps> = ({
  babalawo,
  onBookSession,
  onViewProfile
}) => {
  const displayName = babalawo.profiles?.full_name || "Babalawo";
  const avatarUrl = babalawo.profiles?.avatar_url;
  const isVerified = babalawo.verification_status === 'approved';
  
  console.log('[BabalawoCard] Rendering babalawo:', babalawo.id, 'with name:', displayName);
  
  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-5 flex flex-col items-center text-center fade-in">
      {/* Avatar */}
      <div className="relative mb-3">
        <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-primary">
          {avatarUrl ? (
            <AvatarImage
              src={avatarUrl}
              alt={displayName}
            />
          ) : (
            <AvatarFallback className="text-lg sm:text-xl bg-primary/10 text-primary">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          )}
        </Avatar>
        {isVerified && (
          <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
      
      {/* Name and Title */}
      <div className="mb-2">
        <div className="font-semibold text-base sm:text-lg text-gray-900 mb-1 text-center">
          {displayName}
        </div>
        <div className="text-sm text-gray-600">
          Ifa Priest & Spiritual Guide
        </div>
      </div>
      
      {/* Rating and Sessions */}
      <div className="text-xs sm:text-sm text-gray-600 mb-2">
        ⭐ {babalawo.rating || 5.0} • {babalawo.total_sessions || 0} sessions
      </div>
      
      {/* Location/Timezone */}
      {babalawo.timezone && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <MapPin className="w-3 h-3" />
          <span>{babalawo.timezone}</span>
        </div>
      )}
      
      {/* Specialties */}
      {babalawo.specialties && babalawo.specialties.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3 justify-center">
          {babalawo.specialties.slice(0, 2).map((specialty, index) => (
            <span key={index} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
              {specialty}
            </span>
          ))}
          {babalawo.specialties.length > 2 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
              +{babalawo.specialties.length - 2} more
            </span>
          )}
        </div>
      )}
      
      {/* Price */}
      <div className="text-sm font-semibold text-gray-800 mb-3">
        ₦{(babalawo.hourly_rate || 15000).toLocaleString()}/session
      </div>
      
      {/* Action Buttons */}
      <div className="w-full space-y-2">
        <button 
          className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors text-sm sm:text-base"
          onClick={() => onBookSession(babalawo)}
        >
          Book Session
        </button>
        <button 
          className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
          onClick={() => onViewProfile(babalawo.id)}
        >
          View Profile
        </button>
      </div>
    </div>
  );
};

export default BabalawoCard;
