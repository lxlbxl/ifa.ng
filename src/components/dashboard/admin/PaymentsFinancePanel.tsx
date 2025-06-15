import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "lucide-react";
import { format } from "date-fns";

const PaymentsFinancePanel = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    async function fetchPayments() {
      setLoading(true);
      const { data, error } = await supabase
        .from("payments")
        .select(
          "*, users:user_id(profiles(full_name)), babalawos:babalawo_id(profiles(full_name))"
        );

      if (error) {
        console.error("Error fetching payments:", error);
        setLoading(false);
        return;
      }

      setPayments(data || []);
      setTotalRevenue(
        (data || []).reduce((sum, p) => sum + Number(p.amount), 0)
      );
      setLoading(false);
    }

    fetchPayments();
  }, []);

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Payments & Finance</CardTitle>
        <CardDescription>
          Overview of transactions and financial data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xl font-semibold">
          Total Revenue: ₦{totalRevenue.toLocaleString()}
        </div>

        {/* CSV Export */}
        <div className="flex justify-end mb-2">
          <button
            className="text-xs px-3 py-1 font-semibold bg-primary text-white rounded hover:bg-primary/90 transition"
            onClick={() => {
              // Convert all values to strings to avoid assignment errors
              const paymentsCsv =
                "Date,User,Babalawo,Amount,Status\n" +
                payments
                  .map(
                    (p: any) =>
                      [
                        (p.created_at ?? "").toString(),
                        (p.users?.profiles?.full_name ?? ""),
                        (p.babalawos?.profiles?.full_name ?? ""),
                        (p.amount !== undefined && p.amount !== null ? p.amount.toString() : "0"),
                        (p.status ?? "").toString(),
                      ].join(",")
                  )
                  .join("\n");
              const blob = new Blob([paymentsCsv], { type: "text/csv" });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "payments.csv";
              a.click();
              window.URL.revokeObjectURL(url);
            }}
          >
            Download CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Babalawo</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Loading payments...
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No payments found.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {format(new Date(payment.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {payment.users?.profiles?.full_name || "N/A"}
                    </TableCell>
                    <TableCell>
                      {payment.babalawos?.profiles?.full_name || "N/A"}
                    </TableCell>
                    <TableCell>₦{payment.amount.toLocaleString()}</TableCell>
                    <TableCell>{payment.status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentsFinancePanel;
