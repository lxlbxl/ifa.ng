import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { apiFetch } from "@/integrations/api/config";

interface Props {
  userId: string;
  fullName: string;
  avatarUrl: string | null | undefined;
  onAvatarUploaded: (url: string) => Promise<void>;
}

/** Uploads to our API, which checks the image and saves it as this person's photo. */
async function uploadAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  const { url } = await apiFetch<{ url: string }>("/v1/me/avatar", { method: "POST", body: form });
  return url;
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
      const url = await uploadAvatar(file);
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
