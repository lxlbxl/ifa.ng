import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BabalawoSpecialties: React.FC = () => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Specialties</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-center py-8 text-gray-500">
          Specialties management coming soon.
        </p>
      </CardContent>
    </Card>
  );
};

export default BabalawoSpecialties;