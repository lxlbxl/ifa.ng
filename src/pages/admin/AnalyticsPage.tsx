import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PaymentAnalyticsDashboard from "@/components/dashboard/admin/PaymentAnalyticsDashboard";
import AuditLogViewer from "@/components/dashboard/admin/AuditLogViewer";
import { BarChart3, Shield } from "lucide-react";

const AnalyticsPage = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Analytics & Monitoring</h1>
        <p className="text-gray-600 mt-2">
          Track payment performance, revenue, and security events
        </p>
      </div>

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Payment Analytics
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <PaymentAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;
