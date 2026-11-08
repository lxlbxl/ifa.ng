import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PaymentsFinancePanel: React.FC = () => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Payments & Finance</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-center py-8 text-gray-500">
          Payments and finance management coming soon. Database schema needs to be updated.
        </p>
      </CardContent>
    </Card>
  );
};

export default PaymentsFinancePanel;