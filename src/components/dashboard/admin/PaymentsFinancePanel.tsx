
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Download, Filter } from "lucide-react";
import {
  Table, TableHeader, TableBody, TableRow, TableCell, TableHead, TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type Payment = {
  id: string;
  created_at: string;
  user_id: string;
  babalawo_id: string;
  amount: number;
  admin_commission: number;
  babalawo_share: number;
  flutterwave_transaction_id: string | null;
  flutterwave_reference: string | null;
  payment_method: string | null;
  status: string;
  currency: string;
  updated_at: string;
};

type Refund = {
  id: string;
  created_at: string;
  payment_id: string;
  amount: number;
  reason: string | null;
  status: string;
  flutterwave_refund_id: string | null;
  processed_by: string | null;
  updated_at: string;
};

type Payout = {
  id: string;
  babalawo_id: string;
  amount: number;
  status: string;
  payment_method: string | null;
  bank_details: any;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

const fetchPayments = async () => {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error("Failed to fetch payments");
  }
  return data as Payment[];
};

const fetchRefunds = async () => {
  const { data, error } = await supabase
    .from("refunds")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error("Failed to fetch refunds");
  }
  return data as Refund[];
};

const fetchPayouts = async () => {
  const { data, error } = await supabase
    .from("payouts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error("Failed to fetch payouts");
  }
  return data as Payout[];
};

const CSV_HEADER = [
  "ID", "Date", "User ID", "Babalawo ID", "Amount", "Commission", "Babalawo Share", "Status", "Reference", "Transaction ID", "Payment Method"
];

function exportCSV(payments: Payment[]) {
  const rows = [CSV_HEADER];
  payments.forEach(p => {
    rows.push([
      p.id, p.created_at, p.user_id, p.babalawo_id, p.amount, p.admin_commission,
      p.babalawo_share, p.status, p.flutterwave_reference, p.flutterwave_transaction_id, p.payment_method,
    ]);
  });
  const csvContent = rows.map(row => row.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "payments_export.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const PaymentsFinancePanel: React.FC = () => {
  const [tab, setTab] = useState<"payments" | "refunds" | "payouts">("payments");
  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ["adminPayments"],
    queryFn: fetchPayments,
  });
  const { data: refunds, isLoading: loadingRefunds } = useQuery({
    queryKey: ["adminRefunds"],
    queryFn: fetchRefunds,
  });
  const { data: payouts, isLoading: loadingPayouts } = useQuery({
    queryKey: ["adminPayouts"],
    queryFn: fetchPayouts,
  });

  // Simple revenue breakdown
  const totalRevenue = useMemo(
    () => (payments ? payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) : 0),
    [payments]
  );
  const totalCommission = useMemo(
    () => (payments ? payments.reduce((sum, p) => sum + (Number(p.admin_commission) || 0), 0) : 0),
    [payments]
  );
  const totalBabalawoShare = useMemo(
    () => (payments ? payments.reduce((sum, p) => sum + (Number(p.babalawo_share) || 0), 0) : 0),
    [payments]
  );

  // TODO: Filtering, PDF export, manual refund trigger, advanced status integration

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-playfair mb-1">Payments & Finance</h2>
          <div className="flex text-gray-600 gap-6 text-base">
            <div>
              <span className="font-bold text-gray-900">Total Revenue: </span>
              ₦{totalRevenue.toLocaleString("en-NG")}
            </div>
            <div>
              <span className="font-bold text-gray-900">Admin Commission: </span>
              ₦{totalCommission.toLocaleString("en-NG")}
            </div>
            <div>
              <span className="font-bold text-gray-900">Babalawo Share: </span>
              ₦{totalBabalawoShare.toLocaleString("en-NG")}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {tab === "payments" && (
            <Button
              variant="outline"
              className="flex gap-1"
              onClick={() => exportCSV(payments ?? [])}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          )}
          <Button variant="outline" className="hidden sm:flex gap-1">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          size="sm"
          variant={tab === "payments" ? "default" : "outline"}
          onClick={() => setTab("payments")}
        >
          All Payments
        </Button>
        <Button
          size="sm"
          variant={tab === "refunds" ? "default" : "outline"}
          onClick={() => setTab("refunds")}
        >
          Refunds
        </Button>
        <Button
          size="sm"
          variant={tab === "payouts" ? "default" : "outline"}
          onClick={() => setTab("payouts")}
        >
          Payouts
        </Button>
      </div>

      <Card className="overflow-x-auto border-0 shadow">
        {tab === "payments" && (
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Babalawo Share</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Babalawo ID</TableHead>
                <TableHead>Ref.</TableHead>
                <TableHead>Txn ID</TableHead>
                <TableHead>Method</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {loadingPayments && (
                <TableRow>
                  <TableCell colSpan={10}>Loading...</TableCell>
                </TableRow>
              )}
              {payments?.length === 0 && !loadingPayments && (
                <TableRow>
                  <TableCell colSpan={10}>No payments found.</TableCell>
                </TableRow>
              )}
              {payments?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <span
                      className={
                        "px-2 py-1 rounded-full text-xs " +
                        (p.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : p.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-500")
                      }
                    >
                      {p.status}
                    </span>
                  </TableCell>
                  <TableCell>₦{Number(p.amount).toLocaleString()}</TableCell>
                  <TableCell>₦{Number(p.admin_commission).toLocaleString()}</TableCell>
                  <TableCell>₦{Number(p.babalawo_share).toLocaleString()}</TableCell>
                  <TableCell>{p.user_id.slice(0, 8)}...</TableCell>
                  <TableCell>{p.babalawo_id.slice(0, 8)}...</TableCell>
                  <TableCell className="text-xs">{p.flutterwave_reference ? <a href={`https://dashboard.flutterwave.com/v3/transactions/${p.flutterwave_transaction_id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{p.flutterwave_reference}</a> : "-"}</TableCell>
                  <TableCell className="text-xs">{p.flutterwave_transaction_id || "-"}</TableCell>
                  <TableCell>{p.payment_method || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {tab === "refunds" && (
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment ID</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Processed By</TableHead>
                <TableHead>Refund Ref.</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {loadingRefunds && (
                <TableRow>
                  <TableCell colSpan={7}>Loading...</TableCell>
                </TableRow>
              )}
              {refunds?.length === 0 && !loadingRefunds && (
                <TableRow>
                  <TableCell colSpan={7}>No refunds found.</TableCell>
                </TableRow>
              )}
              {refunds?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <span
                      className={
                        "px-2 py-1 rounded-full text-xs " +
                        (r.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : r.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-500")
                      }
                    >
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell>₦{Number(r.amount).toLocaleString()}</TableCell>
                  <TableCell>{r.payment_id.slice(0, 8)}...</TableCell>
                  <TableCell>{r.reason || "-"}</TableCell>
                  <TableCell>{r.processed_by ? r.processed_by.slice(0, 8) + "..." : "-"}</TableCell>
                  <TableCell className="text-xs">{r.flutterwave_refund_id || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {tab === "payouts" && (
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Babalawo ID</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Bank Details</TableHead>
                <TableHead>Processed At</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {loadingPayouts && (
                <TableRow>
                  <TableCell colSpan={7}>Loading...</TableCell>
                </TableRow>
              )}
              {payouts?.length === 0 && !loadingPayouts && (
                <TableRow>
                  <TableCell colSpan={7}>No payouts found.</TableCell>
                </TableRow>
              )}
              {payouts?.map((po) => (
                <TableRow key={po.id}>
                  <TableCell>{new Date(po.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <span
                      className={
                        "px-2 py-1 rounded-full text-xs " +
                        (po.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : po.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-500")
                      }
                    >
                      {po.status}
                    </span>
                  </TableCell>
                  <TableCell>₦{Number(po.amount).toLocaleString()}</TableCell>
                  <TableCell>{po.babalawo_id.slice(0, 8)}...</TableCell>
                  <TableCell>{po.payment_method || "-"}</TableCell>
                  <TableCell>
                    <span className="whitespace-pre-wrap text-xs">{po.bank_details ? JSON.stringify(po.bank_details) : "-"}</span>
                  </TableCell>
                  <TableCell>{po.processed_at ? new Date(po.processed_at).toLocaleString() : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <div className="text-sm text-gray-500 mt-4">
        <b>Note:</b> This dashboard loads live payment, refund, and payout data from Supabase.
        Export CSV is available for payments. Filtering and advanced exports coming soon.
      </div>
    </div>
  );
};

export default PaymentsFinancePanel;
