export type WebsiteBookingCapacityDay = {
  date: string;
  available: boolean;
  reason?: string;
  capacity?: number;
  bookedCount?: number;
  remainingCapacity?: number;
};

export type WebsiteBookingCapacityProjection = {
  configured: boolean;
  timezone: "Pacific/Auckland";
  minimumLeadDays: number;
  weeklyBookingCap: number;
  days: WebsiteBookingCapacityDay[];
};

export type DateAvailabilityResult = {
  available: boolean;
  reason?: string;
  capacity: number;
  bookedCount: number;
  remainingCapacity: number;
};

const LOCAL_BOOKINGS_STORAGE_KEY = "awww_booked_dates_count_cache";

/**
 * Returns today's date string in NZ format (YYYY-MM-DD).
 */
export function getTodayNZString(): string {
  try {
    const d = new Date();
    const nzDateStr = d.toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" }); // "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(nzDateStr)) {
      return nzDateStr;
    }
  } catch {
    // Fallback if timeZone formatting fails
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Loads and automatically prunes local booking cache from localStorage.
 * Removes any date keys older than today in real life.
 */
export function getLocalBookingsCache(): Record<string, number> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(LOCAL_BOOKINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (!parsed || typeof parsed !== "object") return {};

    const todayStr = getTodayNZString();
    let hasExpired = false;
    const cleanCache: Record<string, number> = {};

    for (const [dateKey, count] of Object.entries(parsed)) {
      if (typeof count === "number" && count > 0) {
        if (dateKey >= todayStr) {
          cleanCache[dateKey] = count;
        } else {
          hasExpired = true;
        }
      }
    }

    if (hasExpired) {
      localStorage.setItem(LOCAL_BOOKINGS_STORAGE_KEY, JSON.stringify(cleanCache));
    }

    return cleanCache;
  } catch {
    return {};
  }
}

/**
 * Records a new booking locally on the frontend for dateStr (YYYY-MM-DD).
 * Increments the local booking count and persists it.
 */
export function recordLocalBooking(dateStr: string): void {
  if (!dateStr || typeof window === "undefined" || !window.localStorage) return;
  try {
    const cache = getLocalBookingsCache();
    cache[dateStr] = (cache[dateStr] || 0) + 1;
    localStorage.setItem(LOCAL_BOOKINGS_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Returns local booking count for dateStr.
 */
export function getLocalBookingCount(dateStr: string): number {
  const cache = getLocalBookingsCache();
  return cache[dateStr] || 0;
}

/**
 * Evaluates date availability considering Denver's Desk projection, day of week capacity,
 * server booked counts, and local frontend booking cache.
 */
export function getDateAvailability(
  dateStr: string,
  projection: WebsiteBookingCapacityProjection | null
): DateAvailabilityResult {
  const todayStr = getTodayNZString();

  if (dateStr < todayStr) {
    return {
      available: false,
      reason: "Past date",
      capacity: 0,
      bookedCount: 0,
      remainingCapacity: 0,
    };
  }

  const localBooked = getLocalBookingCount(dateStr);

  if (projection && projection.configured) {
    const dayEntry = projection.days?.find((d) => d.date === dateStr);

    if (dayEntry) {
      const dayAvailable = dayEntry.available !== false;
      const capacity = typeof dayEntry.capacity === "number" && dayEntry.capacity > 0
        ? dayEntry.capacity
        : projection.weeklyBookingCap > 0
        ? projection.weeklyBookingCap
        : 1;

      const serverBooked = typeof dayEntry.bookedCount === "number" ? dayEntry.bookedCount : 0;
      const totalBooked = serverBooked + localBooked;
      const remainingCapacity = Math.max(0, capacity - totalBooked);

      if (!dayAvailable) {
        return {
          available: false,
          reason: dayEntry.reason || "No capacity for this day",
          capacity,
          bookedCount: totalBooked,
          remainingCapacity: 0,
        };
      }

      if (totalBooked >= capacity) {
        return {
          available: false,
          reason: capacity > 1 ? `Fully Booked (${totalBooked}/${capacity})` : "Fully Booked",
          capacity,
          bookedCount: totalBooked,
          remainingCapacity: 0,
        };
      }

      return {
        available: true,
        capacity,
        bookedCount: totalBooked,
        remainingCapacity,
      };
    }

    // Date not within projection days list
    return {
      available: false,
      reason: "Outside booking window",
      capacity: 0,
      bookedCount: localBooked,
      remainingCapacity: 0,
    };
  }

  // Fallback when projection is not configured or offline:
  // Check day of week (0 = Sunday, 6 = Saturday)
  const d = new Date(`${dateStr}T12:00:00`);
  const dayOfWeek = d.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const capacity = isWeekend ? 0 : 1;
  const totalBooked = localBooked;
  const remainingCapacity = Math.max(0, capacity - totalBooked);

  if (isWeekend) {
    return {
      available: false,
      reason: "Closed on weekends",
      capacity: 0,
      bookedCount: totalBooked,
      remainingCapacity: 0,
    };
  }

  if (totalBooked >= capacity) {
    return {
      available: false,
      reason: "Fully Booked",
      capacity,
      bookedCount: totalBooked,
      remainingCapacity: 0,
    };
  }

  return {
    available: true,
    capacity,
    bookedCount: totalBooked,
    remainingCapacity,
  };
}
