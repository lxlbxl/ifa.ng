import { toast } from "@/hooks/use-toast";

export interface AppError {
  code: string;
  message: string;
  details?: any;
  retryable?: boolean;
}

export class ErrorService {
  private static instance: ErrorService;
  private errorLog: AppError[] = [];

  static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService();
    }
    return ErrorService.instance;
  }

  logError(error: AppError): void {
    console.error(`[${error.code}] ${error.message}`, error.details);
    this.errorLog.push({
      ...error,
      timestamp: new Date().toISOString()
    } as AppError & { timestamp: string });

    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-100);
    }
  }

  handleError(error: any, context?: string): AppError {
    let appError: AppError;

    if (error?.code && error?.message) {
      // Supabase error
      appError = {
        code: error.code,
        message: this.getReadableErrorMessage(error),
        details: error,
        retryable: this.isRetryableError(error.code)
      };
    } else if (error instanceof Error) {
      // JavaScript error
      appError = {
        code: 'JS_ERROR',
        message: error.message,
        details: error,
        retryable: false
      };
    } else {
      // Unknown error
      appError = {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
        details: error,
        retryable: true
      };
    }

    if (context) {
      appError.code = `${context}_${appError.code}`;
    }

    this.logError(appError);
    return appError;
  }

  showErrorToast(error: AppError, showRetry: boolean = false): void {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  }

  private getReadableErrorMessage(error: any): string {
    const errorMessages: Record<string, string> = {
      'PGRST116': 'No data found',
      'PGRST301': 'Row level security violation',
      '23505': 'This record already exists',
      '23503': 'Referenced record not found',
      '42P01': 'Database table not found',
      'auth/invalid-email': 'Invalid email address',
      'auth/user-not-found': 'User not found',
      'auth/wrong-password': 'Incorrect password',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
    };

    return errorMessages[error.code] || error.message || 'An unexpected error occurred';
  }

  private isRetryableError(code: string): boolean {
    const retryableCodes = [
      'PGRST000', // Generic PostgREST error
      'PGRST301', // RLS violation (might be temporary)
      '08000', // Connection exception
      '08003', // Connection does not exist
      '08006', // Connection failure
      '53300', // Too many connections
    ];

    return retryableCodes.includes(code);
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    context?: string
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const appError = this.handleError(error, context);

        if (!appError.retryable || attempt === maxRetries) {
          throw appError;
        }

        console.log(`Retrying operation (attempt ${attempt}/${maxRetries}) after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }

    throw this.handleError(lastError, context);
  }

  getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }
}

export const errorService = ErrorService.getInstance();

// Utility functions for common error handling patterns
export const handleAsyncError = async <T>(
  operation: () => Promise<T>,
  context?: string,
  showToast: boolean = true
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error) {
    const appError = errorService.handleError(error, context);
    if (showToast) {
      errorService.showErrorToast(appError);
    }
    return null;
  }
};

export const withErrorBoundary = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string
) => {
  return async (...args: T): Promise<R | null> => {
    return handleAsyncError(() => fn(...args), context);
  };
};
