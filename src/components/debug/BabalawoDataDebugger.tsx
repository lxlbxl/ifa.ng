import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const BabalawoDataDebugger: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Babalawo Data Debugger</h1>
        <p className="text-gray-600 mt-2">Debug and inspect babalawo data from different sources</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
          <CardDescription>
            This component is temporarily simplified to resolve build errors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Debug functionality temporarily disabled for build stability.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BabalawoDataDebugger;