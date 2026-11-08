export interface BabalawoEarningsStats {
  allTimeEarnings: number;
  availableBalance: number;
  pendingPayouts: number;
  withdrawalRequests: Array<{
    id: string;
    amount: number;
    status: string;
    created_at: string;
  }>;
  payoutHistory: Array<{
    id: string;
    amount: number;
    method: string;
    reference: string;
    created_at: string;
    status: string;
  }>;
  commissionRates: {
    platformPercent: number;
    babalawoPercent: number;
  };
}