import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Camera } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import BabalawoSpecialties from "./BabalawoSpecialties";
import BabalawoAvatarUploader from "./BabalawoAvatarUploader";
import BabalawoRateSettings from "./BabalawoRateSettings";
import BabalawoAvailabilitySettings from "./BabalawoAvailabilitySettings";

// Add new specialties list
const SPECIALTY_OPTIONS = [
  "Divination",
  "Spiritual Cleansing",
  "Ifa Consultation",
  "Dream Interpretation",
  "Financial Guidance",
  "Family Harmony",
  "Protection Rituals",
  "Love & Relationship",
  "General Advice"
];

const fetchBabalawoProfile = async (id: string) => {
  const { data, error } = await supabase
    .from("babalawos")
    .select("hourly_rate, is_active, specialties")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
};

const fetchAvailability = async (id: string) => {
  const { data, error } = await supabase
    .from("availability")
    .select("*")
    .eq("babalawo_id", id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data;
};

const uploadAvatarToSupabase = async (file: File, userId: string) => {
  const ext = file.name.split('.').pop();
  const filePath = `avatars/${userId}.${ext}`;
  // Remove existing
  await supabase.storage.from("avatars").remove([`avatars/${userId}.png`, `avatars/${userId}.jpg`, `avatars/${userId}.jpeg`, `avatars/${userId}.webp`]);
  // Upload new
  const { data, error } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(filePath);
  return publicUrl;
};

const BabalawoProfileSettings = () => {
  const { user, userProfile, updateProfile, refreshProfile } = useAuth();

  // PROFILE INFO (rate, status, specialties)
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-babalawo-profile", user?.id],
    queryFn: () => user?.id ? fetchBabalawoProfile(user.id) : null,
    enabled: !!user?.id,
  });

  // Avatar upload callback
  const handleAvatarUploaded = async (url: string) => {
    await updateProfile({ avatar_url: url });
    await refreshProfile();
  };

  const avatar_url = userProfile?.avatar_url;
  const full_name = userProfile?.full_name ?? "B";

  return (
    <Card className="my-8 max-w-full px-4 sm:px-6 md:px-8">
      <CardHeader>
        <CardTitle>My Rate & Availability Settings</CardTitle>
      </CardHeader>
      <CardContent>
        {user?.id && (
          <>
            <BabalawoSpecialties
              userId={user.id}
              initialSpecialties={Array.isArray(profile?.specialties) ? profile.specialties : []}
            />
            <BabalawoAvatarUploader
              userId={user.id}
              fullName={full_name}
              avatarUrl={avatar_url}
              onAvatarUploaded={handleAvatarUploaded}
            />
            <BabalawoRateSettings
              userId={user.id}
              initialRate={profile?.hourly_rate}
              loading={profileLoading}
            />
            <BabalawoAvailabilitySettings
              userId={user.id}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BabalawoProfileSettings;
