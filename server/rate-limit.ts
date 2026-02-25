const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, AttemptRecord>();

export function checkRateLimit(tripId: string): { allowed: boolean; retryAfter?: number } {
  const record = attempts.get(tripId);
  if (!record) return { allowed: true };

  if (record.lockedUntil) {
    const now = Date.now();
    if (now < record.lockedUntil) {
      return { allowed: false, retryAfter: Math.ceil((record.lockedUntil - now) / 1000) };
    }
    attempts.delete(tripId);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedAttempt(tripId: string): { locked: boolean; retryAfter?: number } {
  const now = Date.now();
  let record = attempts.get(tripId);

  if (!record) {
    record = { count: 1, firstAttempt: now, lockedUntil: null };
    attempts.set(tripId, record);
    return { locked: false };
  }

  if (record.lockedUntil && now >= record.lockedUntil) {
    record = { count: 1, firstAttempt: now, lockedUntil: null };
    attempts.set(tripId, record);
    return { locked: false };
  }

  record.count++;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    const retryAfter = Math.ceil(LOCKOUT_MS / 1000);
    return { locked: true, retryAfter };
  }

  return { locked: false };
}

export function clearRateLimit(tripId: string): void {
  attempts.delete(tripId);
}
