import React from "react";
import { useBabalawoEarningsStats } from "@/hooks/useBabalawoEarningsStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BabalawoEarnings = () => {
  const { data, isLoading, isError } = useBabalawoEarningsStats();

  if (isLoading) {
    return <div>Loading earnings data...</div>;
  }

  if (isError || !data) {
    return <div>Error loading earnings data.</div>;
  }

  const {
    allTimeEarnings,
    availableBalance,
    pendingPayouts,
    withdrawalRequests,
    payoutHistory,
    commissionRates,
  } = data;

  return (
    <div className="space-y-8 px-4 sm:px-6 md:px-8">
      <h2 className="text-3xl font-bold text-violet-700">Earnings & Withdrawals</h2>

      <section>
        <h3 className="text-xl font-semibold mb-4">Total Earnings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <Card className="shadow-lg border-l-4 border-violet-600">
            <CardHeader>
              <CardTitle>All Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{allTimeEarnings.toLocaleString()}</div>
            </CardContent>
          </Card>
          {/* Placeholder for monthly and weekly earnings if needed */}
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-4">Balance</h3>
        <Card className="shadow-lg border-l-4 border-green-600 p-4">
          <p className="text-lg font-medium">Available Balance: ₦{availableBalance.toLocaleString()}</p>
          <p className="text-lg font-medium">Pending Payouts: ₦{pendingPayouts.toLocaleString()}</p>
        </Card>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-4">Withdrawal Requests</h3>
        <Card className="shadow-lg border-l-4 border-yellow-600 p-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Requested At</th>
              </tr>
            </thead>
            <tbody>
              {withdrawalRequests.length > 0 ? (
                withdrawalRequests.map((req: any) => (
                  <tr key={req.id} className="border-t border-gray-200">
                    <td className="px-4 py-2">₦{req.amount.toLocaleString()}</td>
                    <td className="px-4 py-2">{req.status}</td>
                    <td className="px-4 py-2">{new Date(req.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-center text-gray-500">
                    No withdrawal requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-4">Payout History</h3>
        <Card className="shadow-lg border-l-4 border-blue-600 p-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2">Paid At</th>
              </tr>
            </thead>
            <tbody>
              {payoutHistory.length > 0 ? (
                payoutHistory.map((payout: any) => (
                  <tr key={payout.id} className="border-t border-gray-200">
                    <td className="px-4 py-2">₦{payout.amount.toLocaleString()}</td>
                    <td className="px-4 py-2">{payout.method}</td>
                    <td className="px-4 py-2">{payout.reference}</td>
                    <td className="px-4 py-2">{new Date(payout.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-center text-gray-500">
                    No payout history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-4">Commission Rate Breakdown</h3>
        <Card className="shadow-lg border-l-4 border-purple-600 p-4">
          <p>Platform: {commissionRates.platformPercent}%</p>
          <p>Babalawo: {commissionRates.babalawoPercent}%</p>
        </Card>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-4">Bank Details</h3>
        <p>Feature to set or update bank details coming soon.</p>
      </section>
    </div>
  );
};

export default BabalawoEarnings;
