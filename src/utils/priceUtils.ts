/**
 * Price parsing utilities
 * Centralized logic for extracting and parsing babalawo prices
 */

const DEFAULT_PRICE = 15000; // ₦15,000 default consultation fee

/**
 * Parse babalawo price from various formats
 * Handles: hourly_rate field, price field, string formats
 */
export const parseBabalawoPrice = (babalawo: any): number => {
  // Try hourly_rate first (preferred)
  if (babalawo.hourly_rate) {
    const rate = parseInt(babalawo.hourly_rate.toString());
    if (!isNaN(rate) && rate > 0) {
      return rate;
    }
  }

  // Try price field as fallback
  if (babalawo.price) {
    const priceStr = babalawo.price.toString();
    const priceMatch = priceStr.match(/\d+/);

    if (priceMatch) {
      const amount = parseInt(priceMatch[0]);

      // Handle cases where price is in thousands (e.g., "25" means ₦25,000)
      if (amount < 1000 && amount > 0) {
        return amount * 1000;
      }

      if (amount >= 100) {
        return amount;
      }
    }
  }

  // Return default if nothing valid found
  return DEFAULT_PRICE;
};

/**
 * Format price for display
 */
export const formatPrice = (amount: number): string => {
  return `₦${amount.toLocaleString()}`;
};

/**
 * Calculate commission split
 */
export const calculateCommission = (
  amount: number,
  platformPercent: number,
  babalawoPercent: number
): { platformAmount: number; babalawoAmount: number } => {
  const platformAmount = (amount * platformPercent) / 100;
  const babalawoAmount = (amount * babalawoPercent) / 100;

  return {
    platformAmount: Math.round(platformAmount * 100) / 100,
    babalawoAmount: Math.round(babalawoAmount * 100) / 100,
  };
};

/**
 * Validate amount is within acceptable range
 */
export const validateAmount = (
  amount: number,
  min: number = 100,
  max: number = 1000000
): { valid: boolean; error?: string } => {
  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: 'Please enter a valid amount' };
  }

  if (amount < min) {
    return { valid: false, error: `Minimum amount is ${formatPrice(min)}` };
  }

  if (amount > max) {
    return { valid: false, error: `Maximum amount is ${formatPrice(max)}` };
  }

  return { valid: true };
};

/**
 * Generate suggested wallet top-up amounts based on common consultation prices
 */
export const getSuggestedAmounts = (currentBalance: number = 0): number[] => {
  const baseAmounts = [1000, 2000, 5000, 10000, 20000, 50000];

  // If balance is very low, suggest smaller amounts
  if (currentBalance < 5000) {
    return [1000, 2000, 5000, 10000, 15000, 20000];
  }

  // Otherwise return standard amounts
  return baseAmounts;
};
