
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
        <div className="h-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1f6e3c" stopOpacity={0.22}/>
                                <stop offset="95%" stopColor="#1f6e3c" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#e3dccb" />
                        <XAxis dataKey="date" tickFormatter={dateFormatter} tick={{ fill: "#5d6457", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={currencyFormatter} tick={{ fill: "#5d6457", fontSize: 12 }} axisLine={false} tickLine={false} width={72} />
                        <Tooltip formatter={(value) => currencyFormatter(value as number)} contentStyle={{ background: "#fffdf7", border: "2px solid #121611", borderRadius: 14 }} />
                        <Area type="monotone" dataKey="revenue" stroke="#1f6e3c" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
    );
};

export default RevenueChart;
