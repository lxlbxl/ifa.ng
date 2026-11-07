/**
 * Structured logging service for IFA Connect
 * Replaces console.log/error with proper log levels and structured data
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private isProduction = import.meta.env.PROD;

  private formatMessage(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...context,
    };

    // In production, you would send this to a logging service like Sentry, DataDog, etc.
    if (this.isProduction) {
      // TODO: Send to external logging service
      // Example: sendToLoggingService(logData);
    }

    // Always log in development
    if (this.isDevelopment) {
      const style = this.getStyleForLevel(level);
      console.log(
        `%c[${level.toUpperCase()}]%c ${message}`,
        style,
        'color: inherit;',
        context ? context : ''
      );
    }
  }

  private getStyleForLevel(level: LogLevel): string {
    switch (level) {
      case 'debug':
        return 'color: #6B7280; font-weight: bold;';
      case 'info':
        return 'color: #3B82F6; font-weight: bold;';
      case 'warn':
        return 'color: #F59E0B; font-weight: bold;';
      case 'error':
        return 'color: #EF4444; font-weight: bold;';
      default:
        return 'color: inherit;';
    }
  }

  debug(message: string, context?: LogContext): void {
    this.formatMessage('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.formatMessage('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.formatMessage('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.formatMessage('error', message, {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }

  // Specific domain loggers
  payment = {
    started: (sessionId: string, amount: number) =>
      this.info('Payment started', { domain: 'payment', sessionId, amount }),
    success: (sessionId: string, reference: string) =>
      this.info('Payment successful', { domain: 'payment', sessionId, reference }),
    failed: (sessionId: string, error: string) =>
      this.error('Payment failed', undefined, { domain: 'payment', sessionId, error }),
  };

  session = {
    created: (sessionId: string, userId: string, babalawoId: string) =>
      this.info('Session created', { domain: 'session', sessionId, userId, babalawoId }),
    started: (sessionId: string) =>
      this.info('Session started', { domain: 'session', sessionId }),
    ended: (sessionId: string) =>
      this.info('Session ended', { domain: 'session', sessionId }),
    error: (sessionId: string, error: string) =>
      this.error('Session error', undefined, { domain: 'session', sessionId, error }),
  };

  auth = {
    login: (userId: string) =>
      this.info('User logged in', { domain: 'auth', userId }),
    logout: (userId: string) =>
      this.info('User logged out', { domain: 'auth', userId }),
    error: (error: string) =>
      this.error('Auth error', undefined, { domain: 'auth', error }),
  };

  video = {
    initialized: (provider: string, sessionId: string) =>
      this.info('Video initialized', { domain: 'video', provider, sessionId }),
    joined: (sessionId: string) =>
      this.info('Video channel joined', { domain: 'video', sessionId }),
    left: (sessionId: string) =>
      this.info('Video channel left', { domain: 'video', sessionId }),
    error: (sessionId: string, error: string) =>
      this.error('Video error', undefined, { domain: 'video', sessionId, error }),
  };

  database = {
    query: (table: string, operation: string) =>
      this.debug('Database query', { domain: 'database', table, operation }),
    error: (table: string, operation: string, error: string) =>
      this.error('Database error', undefined, { domain: 'database', table, operation, error }),
  };
}

// Export singleton instance
export const logger = new Logger();

// Export type for external use
export type { LogLevel, LogContext };
