import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BabalawoManagement: React.FC = () => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Babalawo Management</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-center py-8 text-gray-500">
          Babalawo management feature coming soon. Database schema needs to be updated.
        </p>
      </CardContent>
    </Card>
  );
};

export default BabalawoManagement;