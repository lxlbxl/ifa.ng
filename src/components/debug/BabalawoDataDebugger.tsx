import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Database, User, AlertTriangle, CheckCircle } from 'lucide-react';

interface DebugData {
  babalawos: any[];
  profiles: any[];
  sessions: any[];
  joinedData: any[];
}

const fetchDebugData = async (): Promise<DebugData> => {
  // Fetch raw babalawos data
  const { data: babalawos, error: babalawosError } = await supabase
    .from('babalawos')
    .select('*')
    .eq('verification_status', 'approved')
    .eq('is_active', true);

  if (babalawosError) throw babalawosError;

  // Fetch raw profiles data
  const babalawoIds = babalawos?.map(b => b.id) || [];
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', babalawoIds);

  if (profilesError) throw profilesError;

  // Fetch sample sessions data
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('*')
    .limit(10);

  if (sessionsError) throw sessionsError;

  // Fetch joined data (how our hooks fetch it)
  const { data: joinedData, error: joinedError } = await supabase
    .from('babalawos')
    .select(`
      id,
      specialties,
      experience_years,
      hourly_rate,
      bio,
      verification_status,
      rating,
      total_sessions,
      languages,
      timezone,
      is_active,
      profiles!inner (
        full_name,
        avatar_url
      )
    `)
    .eq('verification_status', 'approved')
    .eq('is_active', true);

  if (joinedError) throw joinedError;

  return {
    babalawos: babalawos || [],
    profiles: profiles || [],
    sessions: sessions || [],
    joinedData: joinedData || []
  };
};

const BabalawoDataDebugger: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['debugBabalawoData'],
    queryFn: fetchDebugData,
    enabled: isOpen,
  });

  const analyzeData = () => {
    if (!data) return null;

    const { babalawos, profiles, joinedData } = data;
    
    const analysis = {
      totalBabalawos: babalawos.length,
      totalProfiles: profiles.length,
      babalawosMissingProfiles: babalawos.filter(b => !profiles.find(p => p.id === b.id)),
      profilesWithoutNames: profiles.filter(p => !p.full_name || p.full_name.trim() === ''),
      joinedDataCount: joinedData.length,
      joinedDataWithNames: joinedData.filter(j => {
        const profile = Array.isArray(j.profiles) ? j.profiles[0] : j.profiles;
        return profile?.full_name && profile.full_name.trim() !== '';
      }),
    };

    return analysis;
  };

  const analysis = analyzeData();

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Babalawo Data Debugger
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {isOpen ? 'Hide Debug Data' : 'Show Debug Data'}
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 mt-4">
            {isLoading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Loading debug data...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Error loading debug data</span>
                </div>
                <p className="text-red-600 text-sm mt-1">{error.message}</p>
                <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-2">
                  Retry
                </Button>
              </div>
            )}

            {data && analysis && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{analysis.totalBabalawos}</div>
                    <div className="text-sm text-blue-800">Total Babalawos</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{analysis.totalProfiles}</div>
                    <div className="text-sm text-green-800">Total Profiles</div>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{analysis.joinedDataCount}</div>
                    <div className="text-sm text-yellow-800">Joined Records</div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{analysis.joinedDataWithNames.length}</div>
                    <div className="text-sm text-purple-800">With Names</div>
                  </div>
                </div>

                {/* Issues */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Data Issues</h3>
                  
                  {analysis.babalawosMissingProfiles.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-red-800 mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Babalawos Missing Profiles ({analysis.babalawosMissingProfiles.length})</span>
                      </div>
                      <div className="space-y-1">
                        {analysis.babalawosMissingProfiles.map(b => (
                          <div key={b.id} className="text-sm text-red-600">
                            ID: {b.id}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.profilesWithoutNames.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-yellow-800 mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Profiles Without Names ({analysis.profilesWithoutNames.length})</span>
                      </div>
                      <div className="space-y-1">
                        {analysis.profilesWithoutNames.map(p => (
                          <div key={p.id} className="text-sm text-yellow-600">
                            ID: {p.id} | Name: "{p.full_name || 'NULL'}"
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.babalawosMissingProfiles.length === 0 && analysis.profilesWithoutNames.length === 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-green-800">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">No data issues found!</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sample Data */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Sample Joined Data</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {data.joinedData.slice(0, 5).map((item, index) => {
                      const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
                      const hasName = profile?.full_name && profile.full_name.trim() !== '';
                      
                      return (
                        <div key={item.id} className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">Record {index + 1}</span>
                            <Badge variant={hasName ? "default" : "destructive"}>
                              {hasName ? "Has Name" : "Missing Name"}
                            </Badge>
                          </div>
                          <div className="text-sm space-y-1">
                            <div><strong>ID:</strong> {item.id}</div>
                            <div><strong>Name:</strong> {profile?.full_name || 'NULL'}</div>
                            <div><strong>Avatar:</strong> {profile?.avatar_url ? 'Yes' : 'No'}</div>
                            <div><strong>Specialties:</strong> {item.specialties?.join(', ') || 'None'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Raw Data Preview */}
                <details className="border rounded-lg">
                  <summary className="p-3 cursor-pointer font-medium">Raw Data (Click to expand)</summary>
                  <div className="p-3 border-t bg-gray-50">
                    <pre className="text-xs overflow-auto max-h-64">
                      {JSON.stringify(data, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

export default BabalawoDataDebugger;
