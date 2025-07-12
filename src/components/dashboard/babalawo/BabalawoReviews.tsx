import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BabalawoReviews: React.FC = () => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Reviews & Ratings</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-center py-8 text-gray-500">
          Reviews management coming soon.
        </p>
      </CardContent>
    </Card>
  );
};

export default BabalawoReviews;