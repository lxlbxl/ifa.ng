
import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle, MapPin } from 'lucide-react';
import { BabalawoProfile } from '@/types/babalawo';

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
  const displayName = babalawo.full_name; // Now guaranteed to be a string
  const avatarUrl = babalawo.avatar_url;
  const isVerified = babalawo.verification_status === 'approved';
  
  console.log('[BabalawoCard] Rendering babalawo:', babalawo.id, 'with name:', displayName);
  
  return (
    <div className="group relative bg-white rounded-2xl shadow-md hover:shadow-2xl p-4 sm:p-5 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-2 animate-fade-in overflow-hidden border border-gray-100">
      {/* Animated gradient background on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-purple-50/30 to-pink-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />

      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

      {/* Avatar */}
      <div className="relative mb-3">
        <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-3 border-primary/30 ring-2 ring-primary/10 group-hover:border-primary group-hover:scale-110 transition-all duration-300">
          {avatarUrl ? (
            <AvatarImage
              src={avatarUrl}
              alt={displayName}
            />
          ) : (
            <AvatarFallback className="text-lg sm:text-xl bg-gradient-to-br from-primary/10 to-purple-50 text-primary">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          )}
        </Avatar>
        {isVerified && (
          <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 shadow-lg animate-bounce-subtle">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Name and Title */}
      <div className="mb-2">
        <div className="font-semibold text-base sm:text-lg text-gray-900 mb-1 text-center group-hover:text-primary transition-colors duration-200">
          {displayName}
        </div>
        <div className="text-sm text-gray-600">
          Ifa Priest & Spiritual Guide
        </div>
      </div>

      {/* Rating and Sessions */}
      <div className="text-xs sm:text-sm text-gray-600 mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 rounded-full">
          <span className="text-yellow-500">⭐</span>
          <span className="font-semibold text-yellow-700">{babalawo.rating || 5.0}</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full text-blue-700 font-medium">
          {babalawo.total_sessions || 0} sessions
        </span>
      </div>

      {/* Location/Timezone */}
      {babalawo.timezone && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-3 bg-gray-50 px-3 py-1.5 rounded-full">
          <MapPin className="w-3 h-3" />
          <span>{babalawo.timezone}</span>
        </div>
      )}

      {/* Specialties */}
      {babalawo.specialties && babalawo.specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 justify-center">
          {babalawo.specialties.slice(0, 2).map((specialty, index) => (
            <span
              key={index}
              className="px-3 py-1.5 bg-gradient-to-r from-primary/10 to-purple-50 text-primary text-xs rounded-full font-medium border border-primary/20 hover:border-primary/40 transition-colors duration-200"
            >
              {specialty}
            </span>
          ))}
          {babalawo.specialties.length > 2 && (
            <span className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
              +{babalawo.specialties.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Price */}
      <div className="text-base font-bold text-gray-900 mb-4 px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
        ₦{(babalawo.hourly_rate || 15000).toLocaleString()}<span className="text-sm text-gray-600 font-normal">/session</span>
      </div>

      {/* Action Buttons */}
      <div className="w-full space-y-2">
        <button
          className="w-full bg-gradient-to-r from-primary to-purple-600 text-white py-2.5 px-4 rounded-xl hover:from-primary/90 hover:to-purple-700 transition-all duration-200 text-sm sm:text-base font-semibold shadow-md hover:shadow-xl transform hover:scale-[1.02] active:scale-95"
          onClick={() => onBookSession(babalawo)}
          aria-label={`Book a session with ${displayName}`}
        >
          Book Session
        </button>
        <button
          className="w-full border-2 border-gray-200 text-gray-700 py-2.5 px-4 rounded-xl hover:bg-gray-50 hover:border-primary/30 transition-all duration-200 text-sm sm:text-base font-medium transform hover:scale-[1.02] active:scale-95"
          onClick={() => onViewProfile(babalawo.id)}
          aria-label={`View profile of ${displayName}`}
        >
          View Profile
        </button>
      </div>
    </div>
  );
};

export default BabalawoCard;
