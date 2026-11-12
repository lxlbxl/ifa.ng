
import React from 'react';
import { Button } from "@/components/ui/button";
import { PortraitCard } from "@/components/brand";
import { blockColors } from "@/design/tokens";
import { babalawoChips } from "@/components/FeaturedBabalawos";
import { usePricing } from '@/hooks/usePricing';
import { EmptyState } from "@/components/dashboard/shell/Panel";
import { useConsultFlow } from "@/components/flow/ConsultFlow";
import { useBabalawos } from '@/hooks/useBabalawos';
import { useNavigate } from 'react-router-dom';

const FindBabalawo = () => {
  const { babalawos, loading, error } = useBabalawos();
  const { currency } = usePricing();
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
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {blockColors.slice(0, 4).map((c) => <div key={c} className="aspect-[4/5] animate-pulse rounded-card opacity-30" style={{ backgroundColor: c }} />)}
      </div>
    );
  }

  if (error) {
    return <EmptyState title="We couldn't load the Babalawos">Check your connection and try again. ({String(error)})</EmptyState>;
  }

  if (!babalawos || babalawos.length === 0) {
    return <EmptyState title="Our first Babalawos are being verified">Check back soon. Everyone listed here is verified before they take bookings.</EmptyState>;
  }

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-8 min-[440px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {babalawos.map((b, i) => (
        <div key={b.id} className="flex flex-col gap-3">
          <PortraitCard
            fluid
            name={b.full_name}
            imageUrl={b.avatar_url}
            chips={babalawoChips(b, currency)}
            status={b.current_status === "online" || b.current_status === "available" ? "available" : null}
            color={blockColors[i % blockColors.length]}
            onClick={() => handleViewProfile(b.id)}
          />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => openConsult(b)}>Book</Button>
            <Button variant="outline" onClick={() => handleViewProfile(b.id)}>Profile</Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FindBabalawo;
