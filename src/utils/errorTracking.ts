import { supabase } from "@/integrations/supabase/client";

interface ErrorTrackingSettings {
  sentry_dsn: string;
  sentry_environment: string;
  error_tracking_enabled: boolean;
}

let sentryInitialized = false;
let Sentry: any = null;

/**
 * Fetch error tracking settings from admin_settings
 */
async function getErrorTrackingSettings(): Promise<ErrorTrackingSettings | null> {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['sentry_dsn', 'sentry_environment', 'error_tracking_enabled']);

    if (error) throw error;

    const settings = (data || []).reduce((acc: any, item) => {
      acc[item.setting_key] = item.setting_value;
      return acc;
    }, {});

    if (settings.error_tracking_enabled === 'false' || !settings.error_tracking_enabled) {
      return null;
    }

    return {
      sentry_dsn: settings.sentry_dsn || '',
      sentry_environment: settings.sentry_environment || 'production',
      error_tracking_enabled: settings.error_tracking_enabled !== 'false'
    };
  } catch (error) {
    console.error('Error fetching error tracking settings:', error);
    return null;
  }
}

/**
 * Initialize Sentry error tracking
 * Call this once during app initialization
 */
export async function initializeErrorTracking() {
  if (sentryInitialized) {
    console.log('Sentry already initialized');
    return;
  }

  const settings = await getErrorTrackingSettings();

  if (!settings || !settings.sentry_dsn) {
    console.log('Sentry is disabled or not configured');
    return;
  }

  try {
    // Dynamically import Sentry to avoid loading it if not needed
    const SentryModule = await import('@sentry/react');
    Sentry = SentryModule;

    Sentry.init({
      dsn: settings.sentry_dsn,
      environment: settings.sentry_environment,
      integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      // Performance Monitoring
      tracesSampleRate: 0.1, // Capture 10% of transactions
      // Session Replay
      replaysSessionSampleRate: 0.1, // Sample 10% of sessions
      replaysOnErrorSampleRate: 1.0, // Sample 100% of sessions with errors
    });

    sentryInitialized = true;
    console.log('✅ Sentry error tracking initialized');
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Capture an exception with Sentry
 */
export function captureException(error: Error, context?: {
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  user?: { id?: string; email?: string; username?: string };
}) {
  if (!sentryInitialized || !Sentry) {
    console.error('Error (Sentry not initialized):', error, context);
    return;
  }

  if (context?.tags) {
    Sentry.setTags(context.tags);
  }

  if (context?.extra) {
    Sentry.setExtras(context.extra);
  }

  if (context?.user) {
    Sentry.setUser(context.user);
  }

  Sentry.captureException(error);
}

/**
 * Capture a message with Sentry
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: {
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}) {
  if (!sentryInitialized || !Sentry) {
    console.log(`Message (Sentry not initialized) [${level}]:`, message, context);
    return;
  }

  if (context?.tags) {
    Sentry.setTags(context.tags);
  }

  if (context?.extra) {
    Sentry.setExtras(context.extra);
  }

  Sentry.captureMessage(message, level);
}

/**
 * Set user context for Sentry
 */
export function setUser(user: { id?: string; email?: string; username?: string } | null) {
  if (!sentryInitialized || !Sentry) {
    return;
  }

  Sentry.setUser(user);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}) {
  if (!sentryInitialized || !Sentry) {
    return;
  }

  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Capture payment error with relevant context
 */
export function capturePaymentError(error: Error, context: {
  paymentMethod: string;
  amount: number;
  userId?: string;
  babalawoId?: number;
  sessionId?: number;
}) {
  captureException(error, {
    tags: {
      error_type: 'payment_error',
      payment_method: context.paymentMethod
    },
    extra: {
      amount: context.amount,
      babalawoId: context.babalawoId,
      sessionId: context.sessionId
    },
    user: context.userId ? { id: context.userId } : undefined
  });
}

/**
 * Capture wallet operation error
 */
export function captureWalletError(error: Error, context: {
  operation: 'debit' | 'credit' | 'rollback';
  amount: number;
  userId?: string;
  transactionId?: string;
}) {
  captureException(error, {
    tags: {
      error_type: 'wallet_error',
      wallet_operation: context.operation
    },
    extra: {
      amount: context.amount,
      transactionId: context.transactionId
    },
    user: context.userId ? { id: context.userId } : undefined
  });
}

/**
 * Capture session booking error
 */
export function captureBookingError(error: Error, context: {
  sessionType: 'scheduled' | 'instant';
  userId?: string;
  babalawoId?: number;
  date?: Date;
}) {
  captureException(error, {
    tags: {
      error_type: 'booking_error',
      session_type: context.sessionType
    },
    extra: {
      babalawoId: context.babalawoId,
      date: context.date?.toISOString()
    },
    user: context.userId ? { id: context.userId } : undefined
  });
}
