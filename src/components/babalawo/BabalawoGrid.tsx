import React from 'react';
import BabalawoCard from './BabalawoCard';
import { BabalawoProfile } from '@/types/babalawo';
import { blockColors } from '@/design/tokens';

interface BabalawoGridProps {
  babalawos: BabalawoProfile[];
  onBookSession: (babalawo: BabalawoProfile) => void;
  onViewProfile: (babalawoId: string) => void;
}

const BabalawoGrid: React.FC<BabalawoGridProps> = ({ babalawos, onBookSession, onViewProfile }) => {
  if (babalawos.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No verified Babalawos are available right now.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-8 min-[460px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {babalawos.map((b, i) => (
        <BabalawoCard
          key={b.id}
          babalawo={b}
          color={blockColors[i % blockColors.length]}
          onBookSession={onBookSession}
          onViewProfile={onViewProfile}
        />
      ))}
    </div>
  );
};

export default BabalawoGrid;
