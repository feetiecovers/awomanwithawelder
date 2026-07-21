export const BOOKING_CONFIRMATION_STORAGE_KEY = "awww-booking-confirmation";

export type BookingConfirmationData = {
  bookingId?: number;
  fullName: string;
  address: string;
  phone: string;
  email: string;
  bookingDate: string;
  notes: string;
  serviceName: string;
  serviceDescription?: string | null;
  estimatedPrice: number;
  subtotal: number;
  gst: number;
  total: number;
};

export function saveBookingConfirmation(data: BookingConfirmationData) {
  sessionStorage.setItem(BOOKING_CONFIRMATION_STORAGE_KEY, JSON.stringify(data));
}

export function loadBookingConfirmation(): BookingConfirmationData | null {
  const raw = sessionStorage.getItem(BOOKING_CONFIRMATION_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as BookingConfirmationData;
  } catch {
    sessionStorage.removeItem(BOOKING_CONFIRMATION_STORAGE_KEY);
    return null;
  }
}

export function clearBookingConfirmation() {
  sessionStorage.removeItem(BOOKING_CONFIRMATION_STORAGE_KEY);
}
