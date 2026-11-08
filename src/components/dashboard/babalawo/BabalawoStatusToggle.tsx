import React, { useState, useEffect } from 'react';
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, WifiOff, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BabalawoStatusToggleProps {
  className?: string;
}

const BabalawoStatusToggle: React.FC<BabalawoStatusToggleProps> = ({ className }) => {
  const { user } = useAuth();
  const [currentStatus, setCurrentStatus] = useState<'online' | 'offline' | 'busy'>('offline');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Fetch current status on component mount
  useEffect(() => {
    const fetchCurrentStatus = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('babalawos')
          .select('current_status')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching status:', error);
          return;
        }

        if (data) {
          setCurrentStatus((data.current_status as 'online' | 'offline' | 'busy') || 'offline');
        }
      } catch (error) {
        console.error('Error fetching babalawo status:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    fetchCurrentStatus();
  }, [user?.id]);

  const updateStatus = async (newStatus: 'online' | 'offline' | 'busy') => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('babalawos')
        .update({ current_status: newStatus })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setCurrentStatus(newStatus);
      toast({
        title: "Status Updated",
        description: `You are now ${newStatus}`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOnlineStatus = () => {
    const newStatus = currentStatus === 'online' ? 'offline' : 'online';
    updateStatus(newStatus);
  };

  const getStatusColor = () => {
    switch (currentStatus) {
      case 'online':
        return 'bg-green-500';
      case 'busy':
        return 'bg-yellow-500';
      case 'offline':
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (currentStatus) {
      case 'online':
        return <Wifi className="h-4 w-4" />;
      case 'busy':
        return <Clock className="h-4 w-4" />;
      case 'offline':
      default:
        return <WifiOff className="h-4 w-4" />;
    }
  };

  if (isInitialLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-4 w-4 bg-gray-300 rounded animate-pulse" />
            Status Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-6 bg-gray-300 rounded mb-3"></div>
            <div className="h-10 bg-gray-300 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {getStatusIcon()}
          Status Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status Display */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Current Status:</span>
          <Badge 
            variant="outline" 
            className={`${getStatusColor()} text-white border-0 capitalize`}
          >
            <div className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-full bg-white`} />
              {currentStatus}
            </div>
          </Badge>
        </div>

        {/* Online/Offline Toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Available for Consultations</span>
            <span className="text-xs text-gray-500">
              Toggle to appear in "Available Now" section
            </span>
          </div>
          <Switch
            checked={currentStatus === 'online'}
            onCheckedChange={toggleOnlineStatus}
            disabled={isLoading}
          />
        </div>

        {/* Busy Status Button */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Set as Busy</span>
            <span className="text-xs text-gray-500">
              You're online but in a session
            </span>
          </div>
          <Switch
            checked={currentStatus === 'busy'}
            onCheckedChange={() => updateStatus(currentStatus === 'busy' ? 'offline' : 'busy')}
            disabled={isLoading}
          />
        </div>

        {/* Status Description */}
        <div className="text-xs text-gray-600 p-3 bg-blue-50 rounded-lg">
          <strong>Online:</strong> Visible to clients seeking instant consultations<br />
          <strong>Busy:</strong> In session, not available for new consultations<br />
          <strong>Offline:</strong> Not available for instant consultations
        </div>
      </CardContent>
    </Card>
  );
};

export default BabalawoStatusToggle;