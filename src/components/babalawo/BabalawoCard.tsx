
import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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
  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-5 flex flex-col items-center text-center fade-in">
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
