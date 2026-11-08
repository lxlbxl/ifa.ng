import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Shield, RefreshCw, Search, Filter } from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  payment_id: string | null;
  event_type: string;
  event_data: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const AuditLogViewer = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [limit, setLimit] = useState<number>(100);

  useEffect(() => {
    fetchAuditLogs();
  }, [eventTypeFilter, limit]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_recent_audit_logs', {
        p_limit: limit,
        p_event_type: eventTypeFilter === 'all' ? null : eventTypeFilter
      });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast({
        title: "Error loading audit logs",
        description: "Could not fetch audit log data",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const getEventBadgeColor = (eventType: string) => {
    const colors: { [key: string]: string } = {
      'payment_initiated': 'bg-blue-100 text-blue-800',
      'payment_completed': 'bg-green-100 text-green-800',
      'payment_failed': 'bg-red-100 text-red-800',
      'payment_refunded': 'bg-yellow-100 text-yellow-800',
      'wallet_credited': 'bg-green-100 text-green-800',
      'wallet_debited': 'bg-orange-100 text-orange-800',
      'session_created': 'bg-purple-100 text-purple-800',
      'webhook_received': 'bg-indigo-100 text-indigo-800',
      'webhook_verified': 'bg-teal-100 text-teal-800'
    };
    return colors[eventType] || 'bg-gray-100 text-gray-800';
  };

  const formatEventData = (data: any) => {
    if (!data) return 'N/A';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Payment Audit Logs
            </CardTitle>
            <CardDescription>
              Track all payment-related events and security activities
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAuditLogs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Event Type</label>
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="payment_initiated">Payment Initiated</SelectItem>
                <SelectItem value="payment_completed">Payment Completed</SelectItem>
                <SelectItem value="payment_failed">Payment Failed</SelectItem>
                <SelectItem value="payment_refunded">Payment Refunded</SelectItem>
                <SelectItem value="wallet_credited">Wallet Credited</SelectItem>
                <SelectItem value="wallet_debited">Wallet Debited</SelectItem>
                <SelectItem value="session_created">Session Created</SelectItem>
                <SelectItem value="webhook_received">Webhook Received</SelectItem>
                <SelectItem value="webhook_verified">Webhook Verified</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium mb-2">Results Limit</label>
            <Select value={String(limit)} onValueChange={(val) => setLimit(parseInt(val))}>
              <SelectTrigger>
                <SelectValue placeholder="Limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 logs</SelectItem>
                <SelectItem value="100">100 logs</SelectItem>
                <SelectItem value="200">200 logs</SelectItem>
                <SelectItem value="500">500 logs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Logs Display */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No audit logs found for the selected filters</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEventBadgeColor(log.event_type)}`}>
                      {log.event_type.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    {log.payment_id && (
                      <span className="text-xs text-gray-500 font-mono">
                        Payment: {log.payment_id.substring(0, 8)}...
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {log.ip_address && (
                    <div>
                      <span className="text-gray-500">IP Address:</span>{' '}
                      <span className="font-mono">{log.ip_address}</span>
                    </div>
                  )}
                  {log.user_agent && (
                    <div>
                      <span className="text-gray-500">User Agent:</span>{' '}
                      <span className="truncate block" title={log.user_agent}>
                        {log.user_agent.substring(0, 50)}...
                      </span>
                    </div>
                  )}
                </div>

                {log.event_data && Object.keys(log.event_data).length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                      View Event Data
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                      {formatEventData(log.event_data)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="mt-6 pt-4 border-t">
          <div className="text-sm text-gray-600">
            Showing {logs.length} audit log{logs.length !== 1 ? 's' : ''}
            {eventTypeFilter !== 'all' && ` for "${eventTypeFilter.replace(/_/g, ' ')}"`}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AuditLogViewer;
