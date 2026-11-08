
import React from 'react';
import BabalawoCard from './BabalawoCard';
import { BabalawoProfile } from '@/types/babalawo';

interface BabalawoGridProps {
  babalawos: BabalawoProfile[];
  onBookSession: (babalawo: BabalawoProfile) => void;
  onViewProfile: (babalawoId: string) => void;
}

const BabalawoGrid: React.FC<BabalawoGridProps> = ({
  babalawos,
  onBookSession,
  onViewProfile
}) => {
  if (babalawos.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No verified babalawos available at the moment.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {babalawos.map((babalawo) => (
        <BabalawoCard
          key={babalawo.id}
          babalawo={babalawo}
          onBookSession={onBookSession}
          onViewProfile={onViewProfile}
        />
      ))}
    </div>
  );
};

export default BabalawoGrid;
