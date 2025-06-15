
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  userId: string;
  initialSpecialties: string[];
}

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

const BabalawoSpecialties: React.FC<Props> = ({ userId, initialSpecialties }) => {
  const [specialties, setSpecialties] = useState<string[]>(initialSpecialties || []);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setSpecialties(Array.isArray(initialSpecialties) ? initialSpecialties : []);
  }, [initialSpecialties]);

  const specialtiesMutation = useMutation({
    mutationFn: async (specialties: string[]) => {
      setError(null);
      setSuccess(null);
      const { error } = await supabase
        .from("babalawos")
        .update({ specialties })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      setSuccess("Specialties updated!");
      queryClient.invalidateQueries({ queryKey: ["my-babalawo-profile", userId] });
    },
    onError: (err: any) => {
      console.error("Specialties save failed", err);
      setError("Failed to save specialties. Please try again.");
    },
  });

  function toggleSpecialty(option: string) {
    setSuccess(null);
    setError(null);
    setSpecialties((specialties) => 
      specialties.includes(option)
        ? specialties.filter((s) => s !== option)
        : [...specialties, option]
    );
  }

  if (!userId) {
    return (
      <div className="mb-8">
        <div className="text-red-600">Cannot load specialties: missing user information.</div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="font-medium mb-2">
        Your Specialties (Pick All That Apply)
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {SPECIALTY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className={`px-3 py-1 rounded-full border focus:outline-none transition
              ${specialties.includes(option)
                ? "bg-primary text-white border-primary"
                : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              }
            `}
            aria-pressed={specialties.includes(option)}
            onClick={() => toggleSpecialty(option)}
            tabIndex={0}
            data-testid={`specialty-${option}`}
          >
            {option}
          </button>
        ))}
      </div>
      <Button
        size="sm"
        onClick={() => specialtiesMutation.mutate(specialties)}
        disabled={specialtiesMutation.isPending}
        data-testid="save-specialties-btn"
      >
        {specialtiesMutation.isPending ? "Saving..." : "Save Specialties"}
      </Button>
      <div className="text-xs text-gray-500 mt-2">
        These will help users find you for relevant consultations.
      </div>
      {success && (
        <div className="mt-3 text-sm text-green-700">{success}</div>
      )}
      {error && (
        <div className="mt-3 text-sm text-red-600">{error}</div>
      )}
    </div>
  );
};

export default BabalawoSpecialties;

