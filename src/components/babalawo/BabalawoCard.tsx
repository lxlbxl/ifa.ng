import React from 'react';
import { BadgeCheck, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PortraitCard } from '@/components/brand';
import { babalawoChips } from '@/components/FeaturedBabalawos';
import { BabalawoProfile } from '@/types/babalawo';
import { usePricing } from '@/hooks/usePricing';

interface BabalawoCardProps {
  babalawo: BabalawoProfile;
  onBookSession: (babalawo: BabalawoProfile) => void;
  onViewProfile: (babalawoId: string) => void;
  color?: string;
}

/** Grid version of the portrait card, with Book and Profile actions under it. */
const BabalawoCard: React.FC<BabalawoCardProps> = ({ babalawo, onBookSession, onViewProfile, color }) => {
  const name = babalawo.full_name;
  const { currency } = usePricing();
  const status =
    babalawo.current_status === 'online' || babalawo.current_status === 'available'
      ? 'available'
      : babalawo.current_status === 'busy' || babalawo.current_status === 'in_session'
        ? 'busy'
        : null;

  return (
    <article className="flex flex-col gap-3">
      <PortraitCard
        fluid
        name={name}
        imageUrl={babalawo.avatar_url}
        chips={babalawoChips(babalawo, currency)}
        status={status}
        color={color}
        onClick={() => onViewProfile(babalawo.id)}
      />
      <div className="flex items-center justify-between gap-2 px-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1 truncate">
          {babalawo.verification_status === 'approved' && (
            <BadgeCheck className="h-4 w-4 flex-none text-green-700" aria-label="Verified" />
          )}
          <span className="truncate">{babalawo.specialties?.slice(0, 2).join(' · ') || 'Ifá divination'}</span>
        </span>
        <span className="inline-flex flex-none items-center gap-1 font-semibold text-ink">
          <Star className="h-4 w-4 fill-sun text-sun" aria-hidden="true" />
          {Number(babalawo.rating || 5).toFixed(1)}
          <span className="font-normal text-muted-foreground">· {babalawo.total_sessions || 0}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => onBookSession(babalawo)} aria-label={`Book a session with ${name}`}>
          Book
        </Button>
        <Button variant="outline" onClick={() => onViewProfile(babalawo.id)} aria-label={`View profile of ${name}`}>
          Profile
        </Button>
      </div>
    </article>
  );
};

export default BabalawoCard;
