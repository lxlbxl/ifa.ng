import React from "react";

const BabalawoEarnings = () => {
  // Placeholder data - replace with real data fetching and state management
  const totalEarningsAllTime = 12000;
  const totalEarningsMonthly = 1500;
  const totalEarningsWeekly = 400;
  const availableBalance = 800;
  const pendingPayouts = 200;
  const withdrawalRequests = [
    { id: 1, amount: 100, status: "Pending", date: "2025-06-15" },
    { id: 2, amount: 150, status: "Completed", date: "2025-05-30" },
  ];
  const payoutHistory = [
    { id: 1, amount: 500, method: "Bank Transfer", reference: "BT12345", date: "2025-05-01" },
    { id: 2, amount: 300, method: "Flutterwave", reference: "FW67890", date: "2025-04-15" },
  ];
  const commissionRates = {
    platformPercent: 20,
    babalawoPercent: 80,
  };

  return (
    <div className="p-8 bg-white rounded-2xl shadow-lg space-y-8">
      <h2 className="text-3xl font-bold text-violet-700">Earnings & Withdrawals</h2>

      <section>
        <h3 className="text-xl font-semibold mb-2">Total Earnings</h3>
        <ul className="grid grid-cols-3 gap-4 text-center">
          <li>
            <div className="text-2xl font-bold">₦{totalEarningsAllTime.toLocaleString()}</div>
            <div className="text-sm text-gray-600">All Time</div>
          </li>
          <li>
            <div className="text-2xl font-bold">₦{totalEarningsMonthly.toLocaleString()}</div>
            <div className="text-sm text-gray-600">This Month</div>
          </li>
          <li>
            <div className="text-2xl font-bold">₦{totalEarningsWeekly.toLocaleString()}</div>
            <div className="text-sm text-gray-600">This Week</div>
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Balance</h3>
        <p className="text-lg font-medium">Available Balance: ₦{availableBalance.toLocaleString()}</p>
        <p className="text-lg font-medium">Pending Payouts: ₦{pendingPayouts.toLocaleString()}</p>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Withdrawal Requests</h3>
        <table className="w-full text-left border border-gray-200 rounded-md">
          <thead className="bg-violet-100">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {withdrawalRequests.map((req) => (
              <tr key={req.id} className="border-t border-gray-200">
                <td className="px-4 py-2">{req.date}</td>
                <td className="px-4 py-2">₦{req.amount.toLocaleString()}</td>
                <td className="px-4 py-2">{req.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Payout History</h3>
        <table className="w-full text-left border border-gray-200 rounded-md">
          <thead className="bg-violet-100">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Method</th>
              <th className="px-4 py-2">Reference</th>
            </tr>
          </thead>
          <tbody>
            {payoutHistory.map((payout) => (
              <tr key={payout.id} className="border-t border-gray-200">
                <td className="px-4 py-2">{payout.date}</td>
                <td className="px-4 py-2">₦{payout.amount.toLocaleString()}</td>
                <td className="px-4 py-2">{payout.method}</td>
                <td className="px-4 py-2">{payout.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Commission Rate Breakdown</h3>
        <p>Platform: {commissionRates.platformPercent}%</p>
        <p>Babalawo: {commissionRates.babalawoPercent}%</p>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Bank Details</h3>
        <p>Feature to set or update bank details coming soon.</p>
      </section>
    </div>
  );
};

export default BabalawoEarnings;
