
import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle, MapPin } from 'lucide-react';
import { BabalawoProfile } from '@/types/babalawo';
import { motion } from 'framer-motion';
import TiltCard from '@/components/animations/TiltCard';

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
    <TiltCard tiltMaxAngleX={5} tiltMaxAngleY={5} scale={1.02}>
      <motion.div
        className="bg-white rounded-xl shadow-md p-4 sm:p-5 flex flex-col items-center text-center h-full"
        whileHover={{ y: -5 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Avatar */}
        <motion.div
          className="relative mb-3"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
        >
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
            <motion.div
              className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", delay: 0.3 }}
            >
              <CheckCircle className="w-4 h-4 text-white" />
            </motion.div>
          )}
        </motion.div>
      
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
        <motion.div
          className="w-full space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <motion.button
            className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white py-2 px-4 rounded-lg text-sm sm:text-base font-medium shadow-md"
            onClick={() => onBookSession(babalawo)}
            aria-label={`Book a session with ${displayName}`}
            whileHover={{ scale: 1.02, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            Book Session
          </motion.button>
          <motion.button
            className="w-full border-2 border-gray-300 text-gray-700 py-2 px-4 rounded-lg text-sm sm:text-base font-medium"
            onClick={() => onViewProfile(babalawo.id)}
            aria-label={`View profile of ${displayName}`}
            whileHover={{ scale: 1.02, borderColor: "rgb(249, 115, 22)" }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            View Profile
          </motion.button>
        </motion.div>
      </motion.div>
    </TiltCard>
  );
};

export default BabalawoCard;
