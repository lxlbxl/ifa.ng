import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft, RefreshCw, HelpCircle } from 'lucide-react';

const PaymentFailed: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const error = searchParams.get('error') || 'Payment was not completed';
  const ref = searchParams.get('ref');
  const type = searchParams.get('type'); // 'session' or 'wallet'

  const commonErrors: { [key: string]: { title: string; description: string; action: string } } = {
    'insufficient_funds': {
      title: 'Insufficient Funds',
      description: 'Your card or account has insufficient funds for this transaction.',
      action: 'Please try a different payment method or add funds to your wallet.'
    },
    'card_declined': {
      title: 'Card Declined',
      description: 'Your card was declined by your bank.',
      action: 'Please contact your bank or try a different card.'
    },
    'network_error': {
      title: 'Network Error',
      description: 'The payment could not be processed due to a network issue.',
      action: 'Please check your internet connection and try again.'
    },
    'timeout': {
      title: 'Payment Timeout',
      description: 'The payment session has expired.',
      action: 'Please try again and complete the payment within the time limit.'
    },
    'cancelled': {
      title: 'Payment Cancelled',
      description: 'You cancelled the payment process.',
      action: 'You can try again whenever you\'re ready.'
    }
  };

  const errorInfo = commonErrors[error] || {
    title: 'Payment Failed',
    description: error,
    action: 'Please try again or contact support if the problem persists.'
  };

  const handleRetry = () => {
    if (type === 'wallet') {
      navigate('/dashboard/user?open=wallet');
    } else {
      navigate('/babalawos');
    }
  };

  const handleContactSupport = () => {
    navigate(`/support?ref=${ref}&issue=payment_failed`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Error Icon */}
        <div className="flex justify-center mb-8">
          <div className="bg-red-100 rounded-full p-6">
            <XCircle className="h-16 w-16 text-red-600" />
          </div>
        </div>

        {/* Error Message */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {errorInfo.title}
          </h1>
          <p className="text-gray-600">
            {errorInfo.description}
          </p>
        </div>

        {/* Error Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-red-700">
              <HelpCircle className="mr-2 h-5 w-5" />
              What Happened?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">
              {errorInfo.action}
            </p>

            {ref && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Reference Number</p>
                <p className="font-mono text-sm break-all">{ref}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Please quote this reference if you contact support
                </p>
              </div>
            )}

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Common Solutions:
              </p>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Check your internet connection</li>
                <li>Ensure you have sufficient funds in your account</li>
                <li>Try a different payment method</li>
                <li>Clear your browser cache and try again</li>
                <li>Contact your bank if the issue persists</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Button
            className="flex-1"
            onClick={handleRetry}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleContactSupport}
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            Contact Support
          </Button>
        </div>

        {/* Back Button */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>

        {/* Support Info */}
        <div className="mt-8 p-4 bg-white rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-2">Need Immediate Help?</h3>
          <p className="text-sm text-gray-600 mb-3">
            Our support team is available 24/7 to assist you with payment issues.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 text-sm">
            <a href="mailto:support@ifa-connect.com" className="text-primary hover:underline">
              Email: support@ifa-connect.com
            </a>
            <span className="hidden sm:inline text-gray-400">|</span>
            <a href="tel:+2348012345678" className="text-primary hover:underline">
              Phone: +234 801 234 5678
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailed;
