
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format } from 'date-fns';

const fetchAdminRevenueStats = async () => {
    const thirtyDaysAgo = subDays(new Date(), 30);

    const { data, error } = await supabase
        .from('sessions')
        .select('session_date, amount')
        .eq('status', 'completed')
        .gte('session_date', format(thirtyDaysAgo, 'yyyy-MM-dd'));

    if (error) {
        console.error('Error fetching revenue stats:', error);
        throw new Error('Could not fetch revenue statistics');
    }

    // Process data for chart
    const dailyRevenue = data.reduce((acc, session) => {
        const date = session.session_date;
        if (!acc[date]) {
            acc[date] = 0;
        }
        acc[date] += session.amount;
        return acc;
    }, {} as Record<string, number>);

    const chartData = Object.keys(dailyRevenue).map(date => ({
        date,
        revenue: dailyRevenue[date]
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return chartData;
};

export const useAdminRevenueStats = () => {
    return useQuery({
        queryKey: ['adminRevenueStats'],
        queryFn: fetchAdminRevenueStats,
    });
};
