import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Share2, ArrowRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { sessionStart } from '@/utils/sessionTime';

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const sessionId = searchParams.get('session_id');
  const paymentRef = searchParams.get('ref');
  const type = searchParams.get('type'); // 'session' or 'wallet'

  useEffect(() => {
    fetchPaymentDetails();
  }, [sessionId, paymentRef]);

  const fetchPaymentDetails = async () => {
    try {
      if (type === 'wallet') {
        // Fetch wallet transaction
        const { data, error } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('payment_reference', paymentRef)
          .single();

        if (!error && data) {
          setPayment(data);
        }
      } else {
        // Fetch session and payment details
        if (sessionId) {
          const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .select(`
              *,
              babalawos (
                full_name,
                avatar_url
              )
            `)
            .eq('id', sessionId)
            .single();

          if (!sessionError && sessionData) {
            setSession(sessionData);
          }

          // Fetch payment record
          const { data: paymentData } = await supabase
            .from('payments')
            .select('*')
            .eq('session_id', sessionId)
            .single();

          if (paymentData) {
            setPayment(paymentData);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching payment details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = () => {
    // TODO: Implement PDF generation
    toast({ title: 'Receipt download coming soon!' });
  };

  const handleShareReceipt = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Payment Receipt',
          text: `Payment successful! Reference: ${paymentRef}`,
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`Payment Reference: ${paymentRef}`);
      toast({ title: 'Payment reference copied to clipboard!' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cloth py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Icon */}
        <div className="flex justify-center mb-8">
          <div className="bg-green-100 rounded-full p-6">
            <CheckCircle className="h-16 w-16 text-green-600" />
          </div>
        </div>

        {/* Success Message */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Successful!
          </h1>
          <p className="text-gray-600">
            {type === 'wallet'
              ? 'Your wallet has been topped up successfully'
              : 'Your consultation has been booked successfully'
            }
          </p>
        </div>

        {/* Payment Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {type === 'session' && session && (
              <>
                <div className="flex items-center space-x-4 pb-4 border-b">
                  <img
                    src={session.babalawos?.avatar_url || '/default-avatar.png'}
                    alt="Babalawo"
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="font-semibold text-lg">
                      {session.babalawos?.full_name || 'Babalawo'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {format(sessionStart(session), "EEEE d MMMM, h:mm a")}
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Amount Paid</p>
                <p className="text-xl font-bold text-green-600">
                  ₦{payment?.amount?.toLocaleString() || '0'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="font-semibold capitalize">
                  {payment?.payment_gateway || 'Wallet'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Reference</p>
                <p className="font-mono text-sm break-all">
                  {paymentRef || payment?.payment_reference}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                  Completed
                </span>
              </div>
            </div>

            {type === 'session' && session && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Session ID: {session.id}
                </p>
                <p className="text-xs text-blue-700">
                  A confirmation email has been sent to your registered email address.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDownloadReceipt}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Receipt
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleShareReceipt}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {type === 'session' ? (
            <>
              <Button
                className="flex-1"
                onClick={() => navigate('/dashboard/user')}
              >
                View My Sessions
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/babalawos')}
              >
                Book Another Session
              </Button>
            </>
          ) : (
            <Button
              className="w-full"
              onClick={() => navigate('/dashboard/user')}
            >
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Support Link */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-600">
            Need help?{' '}
            <a href="/support" className="text-primary hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
