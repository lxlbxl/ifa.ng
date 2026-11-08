import { z } from "zod";

// User Profile Validation
export const userProfileSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  spiritual_interests: z.array(z.string()).optional(),
});

// Babalawo Profile Validation
export const babalawoProfileSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
  bio: z.string().min(50, "Bio must be at least 50 characters").max(1000, "Bio too long"),
  specialties: z.array(z.string()).min(1, "At least one specialty is required").max(10, "Too many specialties"),
  experience_years: z.number().min(1, "Experience must be at least 1 year").max(50, "Invalid experience"),
  hourly_rate: z.number().min(5000, "Rate must be at least ₦5,000").max(100000, "Rate too high"),
  languages: z.array(z.string()).min(1, "At least one language is required"),
  timezone: z.string().min(1, "Timezone is required"),
});

// Session Booking Validation
export const sessionBookingSchema = z.object({
  babalawo_id: z.string().uuid("Invalid babalawo ID"),
  session_date: z.string().refine((date) => {
    const sessionDate = new Date(date);
    const now = new Date();
    return sessionDate > now;
  }, "Session date must be in the future"),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  consultation_type: z.enum(["general", "love", "career", "health", "spiritual"]),
  notes: z.string().max(500, "Notes too long").optional(),
});

// Session Outcome Validation
export const sessionOutcomeSchema = z.object({
  primary_odu: z.string().min(1, "Primary Odu is required").max(50, "Odu name too long"),
  other_odus: z.array(z.string()).max(10, "Too many supporting Odus").optional(),
  ritual_recommendations: z.string().min(10, "Recommendations must be detailed").max(2000, "Recommendations too long"),
  items_needed: z.string().max(1000, "Items list too long").optional(),
  deadline: z.string().optional().refine((date) => {
    if (!date) return true;
    const deadlineDate = new Date(date);
    const now = new Date();
    return deadlineDate > now;
  }, "Deadline must be in the future"),
  next_appointment: z.string().optional().refine((date) => {
    if (!date) return true;
    const appointmentDate = new Date(date);
    const now = new Date();
    return appointmentDate > now;
  }, "Next appointment must be in the future"),
  warnings: z.string().max(1000, "Warnings too long").optional(),
  notes: z.string().max(2000, "Notes too long").optional(),
});

// Payment Validation
export const paymentSchema = z.object({
  amount: z.number().min(1000, "Minimum payment is ₦1,000").max(1000000, "Payment amount too high"),
  payment_method: z.enum(["flutterwave", "paystack", "wallet"]),
  currency: z.literal("NGN"),
});

// Wallet Transaction Validation
export const walletTransactionSchema = z.object({
  amount: z.number().min(0.01, "Amount must be positive"),
  type: z.enum(["credit", "debit"]),
  description: z.string().min(1, "Description is required").max(200, "Description too long"),
  reference: z.string().optional(),
});

// Withdrawal Request Validation
export const withdrawalRequestSchema = z.object({
  amount: z.number().min(1000, "Minimum withdrawal is ₦1,000"),
  bank_name: z.string().min(1, "Bank name is required"),
  account_number: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"),
  account_name: z.string().min(1, "Account name is required"),
  description: z.string().max(200, "Description too long").optional(),
});

// Notification Preferences Validation
export const notificationPreferencesSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  session_reminders: z.boolean(),
  payment_updates: z.boolean(),
  system_announcements: z.boolean(),
  new_babalawos: z.boolean(),
});

// Review Validation
export const reviewSchema = z.object({
  rating: z.number().min(1, "Rating must be at least 1").max(5, "Rating cannot exceed 5"),
  comment: z.string().min(10, "Review must be at least 10 characters").max(500, "Review too long"),
  session_id: z.string().uuid("Invalid session ID"),
});

// Search Filters Validation
export const babalawoSearchSchema = z.object({
  specialties: z.array(z.string()).optional(),
  min_rating: z.number().min(1).max(5).optional(),
  max_rate: z.number().min(1000).max(100000).optional(),
  languages: z.array(z.string()).optional(),
  availability: z.enum(["available", "busy", "offline"]).optional(),
  search_term: z.string().max(100).optional(),
});

// Admin Actions Validation
export const adminCreditWalletSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  amount: z.number().min(1, "Amount must be positive"),
  description: z.string().min(1, "Description is required").max(200, "Description too long"),
});

export const adminWithdrawalApprovalSchema = z.object({
  withdrawal_id: z.string().uuid("Invalid withdrawal ID"),
  status: z.enum(["approved", "rejected"]),
  admin_notes: z.string().max(500, "Notes too long").optional(),
});

// Authentication Validation
export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase, and number"),
  full_name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
  role: z.enum(["user", "babalawo"]),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase, and number"),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

// Utility function to validate data
export const validateData = <T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } => {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => err.message);
      return { success: false, errors };
    }
    return { success: false, errors: ["Validation failed"] };
  }
};

// Utility function for form validation with React Hook Form
export const getZodResolver = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown) => {
    try {
      const validatedData = schema.parse(data);
      return { values: validatedData, errors: {} };
    } catch (error) {
      const errors: Record<string, { message: string }> = {};
      if (error instanceof z.ZodError) {
        error.errors.forEach((err, index) => {
          errors[`field_${index}`] = { message: err.message };
        });
      }
      return { values: {}, errors };
    }
  };
};
