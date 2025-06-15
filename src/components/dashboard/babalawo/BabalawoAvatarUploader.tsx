
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera } from "lucide-react";

interface Props {
  userId: string;
  fullName: string;
  avatarUrl: string | null | undefined;
  onAvatarUploaded: (url: string) => Promise<void>;
}

async function uploadAvatarToSupabase(file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop();
  const filePath = `avatars/${userId}.${ext}`;
  // Remove existing
  await supabase.storage.from("avatars").remove([`avatars/${userId}.png`, `avatars/${userId}.jpg`, `avatars/${userId}.jpeg`, `avatars/${userId}.webp`]);
  // Upload new
  const { data, error } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(filePath);
  return publicUrl;
}

const BabalawoAvatarUploader: React.FC<Props> = ({ userId, fullName, avatarUrl, onAvatarUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !userId) return;
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatarToSupabase(file, userId);
      await onAvatarUploaded(url);
    } catch (err) {
      alert("Error uploading image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-6">
      <div className="font-medium mb-2">Profile Picture</div>
      <div className="flex items-center gap-3">
        <Avatar className="h-16 w-16">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={fullName} />
          ) : (
            <AvatarFallback>{fullName.charAt(0)}</AvatarFallback>
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
  );
};

export default BabalawoAvatarUploader;
