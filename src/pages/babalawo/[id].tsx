import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useBabalawos } from "@/hooks/useBabalawos";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const BabalawoProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const { babalawos, loading, error } = useBabalawos();
  const [profile, setProfile] = useState<any | null>(null);

  useEffect(() => {
    if (!id || loading) return;

    const found = babalawos.find(b => b.id === id);
    if (found) {
      setProfile(found);
    } else {
      setProfile(null);
    }
  }, [id, babalawos, loading]);

  if (loading) {
    return <div className="text-center py-8">Loading profile...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Error loading profile: {error}</div>;
  }

  if (!profile) {
    return <div className="text-center py-8 text-red-600">Profile Not Found</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>{profile.full_name || "Babalawo"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="w-24 h-24">
              {profile.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
              ) : (
                <AvatarFallback>{profile.full_name?.charAt(0) || "B"}</AvatarFallback>
              )}
            </Avatar>
            <div className="text-center">
              <p className="text-lg font-semibold">Ifa Priest & Spiritual Guide</p>
              {profile.specialties && profile.specialties.length > 0 && (
                <p className="text-sm text-gray-600">
                  Specialties: {profile.specialties.join(", ")}
                </p>
              )}
              <p className="text-sm text-gray-600">Timezone: {profile.timezone || "UTC"}</p>
              <p className="text-sm text-gray-600">
                Rate: ₦{profile.hourly_rate?.toLocaleString() || "15,000"}/hr
              </p>
              <p className="text-sm text-gray-600">
                Rating: {profile.rating?.toFixed(1) || "5.0"} ({profile.total_sessions || 0} reviews)
              </p>
              {profile.verification_status === "approved" && (
                <p className="text-green-600 font-semibold">Verified Babalawo</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BabalawoProfilePage;
