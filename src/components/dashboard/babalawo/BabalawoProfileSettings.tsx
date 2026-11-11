import React from "react";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/shell/Panel";

const BabalawoProfileSettings: React.FC = () => (
  <EmptyState
    icon={<UserRound />}
    title="Your public profile is on its way"
    action={<Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("ifa:navigate", { detail: "pricing" }))}>Set your price</Button>}
  >
    Soon you will edit your photo, lineage, languages and specialties here. Your price is already in Pricing.
  </EmptyState>
);

export default BabalawoProfileSettings;
