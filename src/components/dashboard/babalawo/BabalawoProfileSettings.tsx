import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Camera } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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
  const queryClient = useQueryClient();

  // PROFILE INFO (rate, status, specialties)
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-babalawo-profile", user?.id],
    queryFn: () => user?.id ? fetchBabalawoProfile(user.id) : null,
    enabled: !!user?.id,
  });

  // RATE
  const [rate, setRate] = useState("");
  useEffect(() => {
    if (profile?.hourly_rate != null) setRate(profile.hourly_rate.toString());
  }, [profile?.hourly_rate]);

  // SPECIALTIES
  const [specialties, setSpecialties] = useState<string[]>([]);
  useEffect(() => {
    setSpecialties(Array.isArray(profile?.specialties) ? profile.specialties : []);
  }, [profile?.specialties]);
  const specialtiesMutation = useMutation({
    mutationFn: async (specialties: string[]) => {
      const { error } = await supabase
        .from("babalawos")
        .update({ specialties: specialties })
        .eq("id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-babalawo-profile", user?.id] });
    },
  });

  // MUTATION for rate
  const rateMutation = useMutation({
    mutationFn: async (newRate: string) => {
      const { error } = await supabase
        .from("babalawos")
        .update({ hourly_rate: Number(newRate) })
        .eq("id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-babalawo-profile", user?.id] });
    },
  });

  // AVAILABILITY
  const { data: availability = [], isLoading: loadingAvail } = useQuery({
    queryKey: ["my-avail", user?.id],
    queryFn: () => user?.id ? fetchAvailability(user.id) : [],
    enabled: !!user?.id,
  });
  const [slots, setSlots] = useState<any[]>([]);
  useEffect(() => {
    setSlots(Array.isArray(availability) ? availability : []);
  }, [availability]);

  // Save updated slots
  const saveAvailMutation = useMutation({
    mutationFn: async (slots: any[]) => {
      await supabase.from("availability").delete().eq("babalawo_id", user?.id);
      if (slots.length > 0) {
        await supabase.from("availability").insert(
          slots.map(s => ({ ...s, babalawo_id: user?.id }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-avail", user?.id] });
    },
  });

  // Avatar upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !user?.id) return;
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatarToSupabase(file, user.id);
      // Update profile
      await updateProfile({ avatar_url: url });
      await refreshProfile();
    } catch (err) {
      alert("Error uploading image");
    } finally {
      setUploading(false);
    }
  };

  const avatar_url = userProfile?.avatar_url;
  const full_name = userProfile?.full_name ?? "B";

  // Slot UI helpers
  const addSlot = () =>
    setSlots(s => [
      ...s,
      { day_of_week: 1, start_time: "09:00", end_time: "10:00", is_available: true },
    ]);
  const updateSlot = (i: number, key: string, value: any) =>
    setSlots(s => s.map((slot, idx) => (idx === i ? { ...slot, [key]: value } : slot)));
  const removeSlot = (idx: number) =>
    setSlots(s => s.filter((_, i) => i !== idx));

  // New specialty toggle handler
  function toggleSpecialty(option: string) {
    setSpecialties(specialties => {
      if (specialties.includes(option)) {
        return specialties.filter(s => s !== option);
      } else {
        return [...specialties, option];
      }
    });
  }

  return (
    <Card className="my-8">
      <CardHeader>
        <CardTitle>My Rate & Availability Settings</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Specialties Section */}
        <div className="mb-8">
          <div className="font-medium mb-2">Your Specialties (Pick All That Apply)</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {SPECIALTY_OPTIONS.map(option => (
              <button
                key={option}
                type="button"
                className={`px-3 py-1 rounded-full border 
                  ${specialties.includes(option)
                    ? "bg-primary text-white border-primary"
                    : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                  }
                `}
                onClick={() => toggleSpecialty(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => specialtiesMutation.mutate(specialties)}
            disabled={specialtiesMutation.isPending}
          >
            {specialtiesMutation.isPending ? "Saving..." : "Save Specialties"}
          </Button>
          <div className="text-xs text-gray-500 mt-2">
            These will help users find you for relevant consultations.
          </div>
        </div>
        
        {/* Avatar upload */}
        <div className="mb-6">
          <div className="font-medium mb-2">Profile Picture</div>
          <div className="flex items-center gap-3">
            <Avatar className="h-16 w-16">
              {avatar_url ? (
                <AvatarImage src={avatar_url} alt={full_name} />
              ) : (
                <AvatarFallback>{full_name.charAt(0)}</AvatarFallback>
              )}
            </Avatar>
            <Button
              size="sm"
              variant="outline"
              disabled={uploading}
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Change Photo"}
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              accept="image/*"
              disabled={uploading}
              onChange={handleAvatarChange}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Recommended: Square, JPG/PNG, under 2MB
          </div>
        </div>

        {/* Rate */}
        <div className="mb-6">
          <div className="font-medium mb-2">Your Booking Rate (₦ per session)</div>
          {profileLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={100}
                step={100}
                className="w-32"
                value={rate}
                onChange={e => setRate(e.target.value)}
                disabled={rateMutation.isPending}
              />
              <Button
                size="sm"
                onClick={() => rateMutation.mutate(rate)}
                disabled={rateMutation.isPending}
              >
                {rateMutation.isPending ? "Saving..." : "Save Rate"}
              </Button>
            </div>
          )}
        </div>
        {/* Availability */}
        <div className="">
          <div className="font-medium mb-2">Weekly Availability</div>
          {loadingAvail ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Button variant="default" size="sm" onClick={addSlot}>
                + Add Slot
              </Button>
              <div className="space-y-2 mt-2">
                {slots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={slot.day_of_week}
                      onChange={e =>
                        updateSlot(i, "day_of_week", Number(e.target.value))
                      }
                      className="border rounded px-2 py-1"
                    >
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (d, idx) => (
                          <option key={idx} value={idx}>
                            {d}
                          </option>
                        )
                      )}
                    </select>
                    <Input
                      type="time"
                      value={slot.start_time}
                      onChange={e =>
                        updateSlot(i, "start_time", e.target.value)
                      }
                      className="w-28"
                    />
                    <span>-</span>
                    <Input
                      type="time"
                      value={slot.end_time}
                      onChange={e =>
                        updateSlot(i, "end_time", e.target.value)
                      }
                      className="w-28"
                    />
                    <label className="flex items-center text-xs">
                      <input
                        type="checkbox"
                        checked={slot.is_available}
                        onChange={e =>
                          updateSlot(i, "is_available", e.target.checked)
                        }
                        className="mr-1"
                      />
                      Available
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSlot(i)}
                    >
                      🗑️
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={() => saveAvailMutation.mutate(slots)}
                  disabled={saveAvailMutation.isPending}
                >
                  {saveAvailMutation.isPending ? "Saving..." : "Save Availability"}
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BabalawoProfileSettings;
