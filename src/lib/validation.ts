
/**
 * Strong password validator: At least 8 chars, upper, lower, digit, symbol.
 */
export function isStrongPassword(pw: string): boolean {
  return (
    pw.length >= 8 &&
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /\d/.test(pw) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(pw)
  );
}

/**
 * Email validator (improved over HTML5 pattern)
 */
export function isValidEmail(email: string): boolean {
  return (
    /^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/.test(email)
  );
}

/**
 * General string sanitizer – removes potentially dangerous characters.
 * For use with external APIs (e.g., Jitsi room names).
 */
export function sanitizeRoomName(name: string): string {
  // Allow only letters, numbers, dashes, and underscores
  return name.replace(/[^a-zA-Z0-9-_]/g, "");
}
