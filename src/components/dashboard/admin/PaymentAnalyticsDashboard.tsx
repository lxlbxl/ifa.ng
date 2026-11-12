import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  TrendingUp,
  DollarSign,
  CreditCard,
  Users,
  AlertCircle,
  BarChart3,
  PieChart
} from "lucide-react";

interface PaymentStats {
  date: string;
  gateway: string;
  total_transactions: number;
  successful_transactions: number;
  failed_transactions: number;
  total_amount: number;
  success_rate: number;
}

interface TopBabalawo {
  babalawo_id: number;
  babalawo_name: string;
  total_sessions: number;
  total_earnings: number;
  average_session_price: number;
}

interface FailureReason {
  failure_reason: string;
  count: number;
  percentage: number;
}

const PaymentAnalyticsDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<'7' | '30' | '90'>('30');
  const [paymentStats, setPaymentStats] = useState<PaymentStats[]>([]);
  const [topBabalawos, setTopBabalawos] = useState<TopBabalawo[]>([]);
  const [failureReasons, setFailureReasons] = useState<FailureReason[]>([]);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalTransactions: 0,
    successRate: 0,
    totalCommission: 0
  });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));
      const endDate = new Date();

      // Fetch payment statistics
      const { data: stats, error: statsError } = await supabase.rpc(
        'calculate_payment_statistics',
        {
          p_start_date: startDate.toISOString().split('T')[0],
          p_end_date: endDate.toISOString().split('T')[0]
        }
      );

      if (statsError) throw statsError;
      setPaymentStats(stats || []);

      // Calculate summary
      if (stats && stats.length > 0) {
        const totalRevenue = stats.reduce((sum: number, stat: any) => sum + parseFloat(stat.total_amount || 0), 0);
        const totalTransactions = stats.reduce((sum: number, stat: any) => sum + parseInt(stat.total_transactions || 0), 0);
        const totalSuccess = stats.reduce((sum: number, stat: any) => sum + parseInt(stat.successful_transactions || 0), 0);
        const successRate = totalTransactions > 0 ? (totalSuccess / totalTransactions) * 100 : 0;

        setSummary({
          totalRevenue,
          totalTransactions,
          successRate,
          totalCommission: totalRevenue * 0.20 // 20% commission
        });
      }

      // Fetch top earning babalawos
      const { data: top, error: topError } = await supabase.rpc(
        'get_top_earning_babalawos',
        {
          p_limit: 10,
          p_start_date: startDate.toISOString().split('T')[0],
          p_end_date: endDate.toISOString().split('T')[0]
        }
      );

      if (topError) throw topError;
      setTopBabalawos(top || []);

      // Fetch failure reasons
      const { data: failures, error: failuresError } = await supabase.rpc(
        'get_payment_failure_reasons',
        {
          p_start_date: startDate.toISOString().split('T')[0],
          p_end_date: endDate.toISOString().split('T')[0]
        }
      );

      if (failuresError) throw failuresError;
      setFailureReasons(failures || []);

    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Error loading analytics",
        description: "Could not fetch payment analytics data",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Payment Analytics</h2>
          <p className="text-gray-500">Track payment performance and revenue</p>
        </div>
        <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{summary.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Commission: ₦{summary.totalCommission.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTransactions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Last {dateRange} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Payment success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Babalawos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topBabalawos.length}</div>
            <p className="text-xs text-muted-foreground">
              With earnings this period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="payments">Payment Stats</TabsTrigger>
          <TabsTrigger value="babalawos">Top Earners</TabsTrigger>
          <TabsTrigger value="failures">Failed Payments</TabsTrigger>
        </TabsList>

        {/* Payment Statistics Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Payment Statistics by Gateway
              </CardTitle>
              <CardDescription>
                Breakdown of payments by payment method
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paymentStats.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No payment data available for this period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">Gateway</th>
                          <th className="text-right py-2 px-4">Transactions</th>
                          <th className="text-right py-2 px-4">Successful</th>
                          <th className="text-right py-2 px-4">Failed</th>
                          <th className="text-right py-2 px-4">Revenue</th>
                          <th className="text-right py-2 px-4">Success Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(
                          paymentStats.reduce((acc: any, stat) => {
                            if (!acc[stat.gateway]) {
                              acc[stat.gateway] = {
                                gateway: stat.gateway,
                                total: 0,
                                success: 0,
                                failed: 0,
                                amount: 0
                              };
                            }
                            acc[stat.gateway].total += parseInt(String(stat.total_transactions));
                            acc[stat.gateway].success += parseInt(String(stat.successful_transactions));
                            acc[stat.gateway].failed += parseInt(String(stat.failed_transactions));
                            acc[stat.gateway].amount += parseFloat(String(stat.total_amount));
                            return acc;
                          }, {})
                        ).map((agg: any) => (
                          <tr key={agg.gateway} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium capitalize">{agg.gateway}</td>
                            <td className="py-3 px-4 text-right">{agg.total}</td>
                            <td className="py-3 px-4 text-right text-green-600">{agg.success}</td>
                            <td className="py-3 px-4 text-right text-red-600">{agg.failed}</td>
                            <td className="py-3 px-4 text-right">₦{agg.amount.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right">
                              {agg.total > 0 ? ((agg.success / agg.total) * 100).toFixed(1) : 0}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Earning Babalawos Tab */}
        <TabsContent value="babalawos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top Earning Babalawos
              </CardTitle>
              <CardDescription>
                Highest revenue generators for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topBabalawos.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No babalawo earnings data available</p>
              ) : (
                <div className="space-y-3">
                  {topBabalawos.map((babalawo, index) => (
                    <div
                      key={babalawo.babalawo_id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{babalawo.babalawo_name}</div>
                          <div className="text-sm text-gray-500">
                            {babalawo.total_sessions} sessions
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          ₦{parseFloat(String(babalawo.total_earnings)).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          Avg: ₦{parseFloat(String(babalawo.average_session_price)).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Failed Payments Tab */}
        <TabsContent value="failures">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Payment Failure Analysis
              </CardTitle>
              <CardDescription>
                Common reasons for payment failures
              </CardDescription>
            </CardHeader>
            <CardContent>
              {failureReasons.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-green-600 font-medium">No failed payments in this period!</p>
                  <p className="text-sm text-gray-500 mt-1">All transactions were successful</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {failureReasons.map((reason, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{reason.failure_reason}</div>
                        <div className="flex items-center gap-4 mt-1">
                          <div className="text-sm text-gray-500">{reason.count} occurrences</div>
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                            <div
                              className="bg-red-500 h-2 rounded-full"
                              style={{ width: `${reason.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <span className="font-bold text-red-600">{reason.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentAnalyticsDashboard;
