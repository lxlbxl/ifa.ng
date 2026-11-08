import { supabase } from "@/integrations/supabase/client";

export interface SlotLockResult {
  success: boolean;
  lockId?: string;
  message?: string;
  expiresAt?: string;
  lockedByOther?: boolean;
}

/**
 * Acquire a lock on a time slot
 *
 * @param babalawoId - ID of the babalawo
 * @param sessionDate - Date of the session (YYYY-MM-DD format)
 * @param startTime - Start time of the session (HH:MM format)
 * @param userId - ID of the user acquiring the lock
 * @param lockDurationMinutes - Duration of the lock in minutes (default: 5)
 * @returns Lock result with success status and lock ID
 */
export async function acquireSlotLock(
  babalawoId: number | string,
  sessionDate: string,
  startTime: string,
  userId: string,
  lockDurationMinutes: number = 5
): Promise<SlotLockResult> {
  try {
    const { data, error } = await supabase.rpc('acquire_slot_lock', {
      p_babalawo_id: babalawoId,
      p_session_date: sessionDate,
      p_start_time: startTime,
      p_user_id: userId,
      p_lock_duration_minutes: lockDurationMinutes
    });

    if (error) {
      console.error('Error acquiring slot lock:', error);
      return {
        success: false,
        message: 'Failed to acquire slot lock'
      };
    }

    return {
      success: data.success,
      lockId: data.lock_id,
      message: data.message,
      expiresAt: data.expires_at,
      lockedByOther: data.locked_by_other
    };
  } catch (error) {
    console.error('Error acquiring slot lock:', error);
    return {
      success: false,
      message: 'Failed to acquire slot lock'
    };
  }
}

/**
 * Release a slot lock
 *
 * @param lockId - ID of the lock to release
 * @param userId - ID of the user releasing the lock
 * @returns Success status
 */
export async function releaseSlotLock(
  lockId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('release_slot_lock', {
      p_lock_id: lockId,
      p_user_id: userId
    });

    if (error) {
      console.error('Error releasing slot lock:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error releasing slot lock:', error);
    return false;
  }
}

/**
 * Complete a slot lock after successful booking
 *
 * @param lockId - ID of the lock to complete
 * @param userId - ID of the user completing the lock
 * @returns Success status
 */
export async function completeSlotLock(
  lockId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('complete_slot_lock', {
      p_lock_id: lockId,
      p_user_id: userId
    });

    if (error) {
      console.error('Error completing slot lock:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error completing slot lock:', error);
    return false;
  }
}

/**
 * Cleanup expired slot locks
 *
 * This function should be called periodically or on app initialization
 * @returns Number of locks cleaned up
 */
export async function cleanupExpiredLocks(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('cleanup_expired_slot_locks');

    if (error) {
      console.error('Error cleaning up expired locks:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('Error cleaning up expired locks:', error);
    return 0;
  }
}
