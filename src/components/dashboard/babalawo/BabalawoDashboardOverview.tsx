import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BabalawoDashboardOverview: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-gray-500">
            Babalawo dashboard coming soon. Please check back later.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BabalawoDashboardOverview;