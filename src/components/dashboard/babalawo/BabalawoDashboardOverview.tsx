import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Clock, DollarSign, Star, TrendingUp, Users } from "lucide-react";
import { useBabalawoDashboardStats } from "@/hooks/useBabalawoDashboardStatsSimple";
import { useAuth } from "@/hooks/useAuth";
import { PresenceCard } from "./PresenceToggle";

const BabalawoDashboardOverview: React.FC = () => {
  const { userProfile } = useAuth();
  const { data: stats, isLoading } = useBabalawoDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-300 rounded mb-2"></div>
                <div className="h-8 bg-gray-300 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <Card className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-white">
              <AvatarImage src={userProfile?.avatar_url} />
              <AvatarFallback className="bg-white text-purple-600 text-xl font-bold">
                {userProfile?.full_name?.charAt(0) || 'B'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">Welcome, {userProfile?.full_name || 'Babalawo'}</h1>
              <p className="text-purple-100">Ready to guide and heal souls today</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Control and Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Toggle */}
        <PresenceCard className="lg:col-span-1" />
        
        {/* Quick Stats */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Upcoming Sessions</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.upcomingSessions || 0}</p>
                </div>
                <Calendar className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                  <p className="text-3xl font-bold text-gray-900">₦{stats?.totalEarnings?.toLocaleString() || '0'}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalSessions || 0}</p>
                <p className="text-xs text-gray-500 mt-1">All time</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Rating</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold text-gray-900">4.8</p>
                  <Star className="h-5 w-5 text-yellow-500 fill-current" />
                </div>
                <p className="text-xs text-gray-500 mt-1">From reviews</p>
              </div>
              <Star className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upcoming Sessions</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.upcomingSessions || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Awaiting confirmation</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Earned</p>
                <p className="text-3xl font-bold text-gray-900">₦{stats?.totalEarnings?.toLocaleString() || '0'}</p>
                <p className="text-xs text-gray-500 mt-1">Total earnings</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="font-medium">Session completed with Adunni O.</p>
                  <p className="text-sm text-gray-500">2 hours ago</p>
                </div>
              </div>
              <Badge>₦15,000</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="font-medium">New session request from Michael T.</p>
                  <p className="text-sm text-gray-500">4 hours ago</p>
                </div>
              </div>
              <Badge variant="outline">Pending</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                <div>
                  <p className="font-medium">New 5-star review received</p>
                  <p className="text-sm text-gray-500">6 hours ago</p>
                </div>
              </div>
              <Badge variant="secondary">Review</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BabalawoDashboardOverview;