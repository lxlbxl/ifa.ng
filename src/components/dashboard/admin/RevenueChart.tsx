
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminRevenueStats } from "@/hooks/useAdminRevenueStats";
import { Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

const RevenueChart = () => {
    const { data: chartData, isLoading, error } = useAdminRevenueStats();

    if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (error) return <div className="text-red-500">Error: {error.message}</div>;

    const currencyFormatter = (value: number) => `$${value.toFixed(2)}`;
    const dateFormatter = (str: string) => format(new Date(str), 'MMM d');

    return (
        <Card>
            <CardHeader>
                <CardTitle>Revenue (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={dateFormatter} />
                        <YAxis tickFormatter={currencyFormatter} />
                        <Tooltip formatter={(value) => currencyFormatter(value as number)} />
                        <Area type="monotone" dataKey="revenue" stroke="#8884d8" fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

export default RevenueChart;
