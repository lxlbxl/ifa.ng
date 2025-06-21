import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface BabalawoProfile {
  id: string;
  full_name?: string;
  avatar_url?: string;
  title?: string;
  specialties?: string[];
  rating?: number;
  reviews?: number;
  verified?: boolean;
  hourly_rate?: number;
  timezone?: string;
}

const BabalawoProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<BabalawoProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      if (!id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data: babalawoData, error: babalawoError } = await supabase
        .from("babalawos")
        .select("hourly_rate, specialties, rating, total_sessions, verification_status")
        .eq("id", id)
        .single();

      if (babalawoError) {
        console.error("Error fetching babalawo data:", babalawoError);
      }

      setProfile({
        id: data.id,
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        // timezone: babalawoData?.timezone,
        hourly_rate: babalawoData?.hourly_rate,
        specialties: babalawoData?.specialties,
        rating: babalawoData?.rating,
        reviews: babalawoData?.total_sessions,
        verified: babalawoData?.verification_status === "approved",
        title: "Ifa Priest & Spiritual Guide",
      });
      setLoading(false);
    }
    fetchProfile();
  }, [id]);

  if (loading) {
    return <div className="text-center py-8">Loading profile...</div>;
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
              <p className="text-lg font-semibold">{profile.title}</p>
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
                Rating: {profile.rating?.toFixed(1) || "5.0"} ({profile.reviews || 0} reviews)
              </p>
              {profile.verified && (
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
