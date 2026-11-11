import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BabalawoConsultationPanel: React.FC = () => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Consultation Panel</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-center py-8 text-muted-foreground">
          Consultation management coming soon.
        </p>
      </CardContent>
    </Card>
  );
};

export default BabalawoConsultationPanel;