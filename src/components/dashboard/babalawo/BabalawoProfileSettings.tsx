import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BabalawoProfileSettings: React.FC = () => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-center py-8 text-gray-500">
          Profile settings coming soon.
        </p>
      </CardContent>
    </Card>
  );
};

export default BabalawoProfileSettings;