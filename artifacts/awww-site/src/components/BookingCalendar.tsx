import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getDateAvailability,
  getTodayNZString,
  type WebsiteBookingCapacityProjection,
  type DateAvailabilityResult,
} from "@/lib/bookingCache";

interface BookingCalendarProps {
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  projection: WebsiteBookingCapacityProjection | null;
  isLoading?: boolean;
}

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatFriendlyDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "";
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    return new Intl.DateTimeFormat("en-NZ", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function BookingCalendar({
  selectedDate,
  onSelectDate,
  projection,
  isLoading = false,
}: BookingCalendarProps) {
  const todayStr = useMemo(() => getTodayNZString(), []);
  
  // Set initial displayed month to selected date or current month
  const [currentDisplayDate, setCurrentDisplayDate] = useState<Date>(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const parts = selectedDate.split("-").map(Number);
      return new Date(parts[0], parts[1] - 1, 1);
    }
    const todayParts = todayStr.split("-").map(Number);
    return new Date(todayParts[0], todayParts[1] - 1, 1);
  });

  const year = currentDisplayDate.getFullYear();
  const month = currentDisplayDate.getMonth();

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-NZ", { month: "long", year: "numeric" }).format(
      new Date(year, month, 1)
    );
  }, [year, month]);

  // Determine bounds for month navigation (Current month up to 6 months out)
  const isPrevDisabled = useMemo(() => {
    const todayParts = todayStr.split("-").map(Number);
    const minDate = new Date(todayParts[0], todayParts[1] - 1, 1);
    return new Date(year, month, 1) <= minDate;
  }, [year, month, todayStr]);

  const isNextDisabled = useMemo(() => {
    const todayParts = todayStr.split("-").map(Number);
    const maxDate = new Date(todayParts[0], todayParts[1] + 5, 1);
    return new Date(year, month, 1) >= maxDate;
  }, [year, month, todayStr]);

  const handlePrevMonth = () => {
    if (!isPrevDisabled) {
      setCurrentDisplayDate(new Date(year, month - 1, 1));
    }
  };

  const handleNextMonth = () => {
    if (!isNextDisabled) {
      setCurrentDisplayDate(new Date(year, month + 1, 1));
    }
  };

  // Build grid of days
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Convert JS day (0 = Sun, 1 = Mon ... 6 = Sat) to Mon=0 ... Sun=6
    let startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

    const days: Array<{
      dayNum: number | null;
      dateStr: string;
      isToday: boolean;
      availability: DateAvailabilityResult;
    }> = [];

    // Padding for days before the 1st of month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({
        dayNum: null,
        dateStr: "",
        isToday: false,
        availability: { available: false, capacity: 0, bookedCount: 0, remainingCapacity: 0 },
      });
    }

    // Actual days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const availability = getDateAvailability(dateStr, projection);
      days.push({
        dayNum: d,
        dateStr,
        isToday: dateStr === todayStr,
        availability,
      });
    }

    return days;
  }, [year, month, projection, todayStr]);

  const selectedAvailability = useMemo(() => {
    if (!selectedDate) return null;
    return getDateAvailability(selectedDate, projection);
  }, [selectedDate, projection]);

  return (
    <div className="w-full rounded-2xl border border-primary/20 bg-[#060b12]/90 backdrop-blur-md p-4 sm:p-5 shadow-[0_0_30px_rgba(26,157,224,0.08)]">
      {/* Calendar Header / Month Controls */}
      <div className="flex items-center justify-between pb-4 mb-3 border-b border-primary/15">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
          <h4 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-primary">
            {monthLabel}
          </h4>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handlePrevMonth}
            disabled={isPrevDisabled}
            className="h-7 w-7 rounded-lg border-primary/30 bg-primary/5 text-primary hover:bg-primary/20 disabled:opacity-20"
            title="Previous Month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleNextMonth}
            disabled={isNextDisabled}
            className="h-7 w-7 rounded-lg border-primary/30 bg-primary/5 text-primary hover:bg-primary/20 disabled:opacity-20"
            title="Next Month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center font-mono text-xs text-muted-foreground animate-pulse">
          Loading booking capacity calendar...
        </div>
      ) : (
        <>
          {/* Weekday Labels Header */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center mb-2">
            {WEEKDAY_NAMES.map((w) => (
              <div
                key={w}
                className="font-mono text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-primary/70 py-1"
              >
                {w}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarGrid.map((item, idx) => {
              if (item.dayNum === null) {
                return (
                  <div
                    key={`pad-${idx}`}
                    className="aspect-square min-h-[44px] rounded-xl border border-transparent bg-transparent"
                  />
                );
              }

              const isSelected = item.dateStr === selectedDate;
              const { available, reason, capacity, remainingCapacity } = item.availability;

              return (
                <button
                  type="button"
                  key={item.dateStr}
                  disabled={!available}
                  onClick={() => {
                    if (available) {
                      onSelectDate(item.dateStr);
                    }
                  }}
                  className={`relative aspect-square min-h-[46px] rounded-xl border transition-all duration-200 flex flex-col items-center justify-between p-1 select-none ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-bold border-primary shadow-[0_0_20px_rgba(26,157,224,0.65)] scale-[1.03] z-10"
                      : available
                      ? "bg-[#0b1420]/80 border-primary/25 text-slate-100 hover:border-primary/70 hover:bg-primary/20 hover:shadow-[0_0_12px_rgba(26,157,224,0.3)] cursor-pointer"
                      : "bg-[#060a0f]/60 border-slate-800/40 text-muted-foreground/30 cursor-not-allowed opacity-40 line-through decoration-destructive/40"
                  }`}
                  title={
                    available
                      ? `${formatFriendlyDate(item.dateStr)} - Available`
                      : `${formatFriendlyDate(item.dateStr)} - ${reason || "Unavailable"}`
                  }
                  data-testid={`calendar-day-${item.dateStr}`}
                >
                  {/* Today indicator dot */}
                  {item.isToday && (
                    <span
                      className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${
                        isSelected ? "bg-white" : "bg-cyan-400 animate-pulse"
                      }`}
                    />
                  )}

                  {/* Day Number */}
                  <span
                    className={`font-mono text-xs sm:text-sm ${
                      isSelected ? "font-bold text-black" : "font-medium"
                    }`}
                  >
                    {item.dayNum}
                  </span>

                  {/* Status label / Capacity badge */}
                  <span
                    className={`font-mono text-[8px] sm:text-[9px] uppercase tracking-tighter truncate w-full text-center px-0.5 ${
                      isSelected
                        ? "text-black/80 font-bold"
                        : available
                        ? capacity > 1
                          ? "text-cyan-300/80"
                          : "text-emerald-400/80"
                        : "text-rose-400/60 no-underline"
                    }`}
                  >
                    {isSelected
                      ? "Selected"
                      : available
                      ? capacity > 1
                        ? `${remainingCapacity} left`
                        : "Open"
                      : reason === "Fully Booked"
                      ? "Full"
                      : "No Slot"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Calendar Legend */}
          <div className="mt-4 pt-3 border-t border-primary/10 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_6px_rgba(26,157,224,0.8)]" />
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-slate-700/60 opacity-60" />
                <span>No Capacity / Booked</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Selected Date Summary Notice */}
      <div className="mt-3 p-2.5 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-2 font-mono text-xs">
        {selectedDate ? (
          <div className="flex items-center gap-2 text-foreground truncate">
            <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
            <span className="truncate">
              Selected: <strong className="text-primary">{formatFriendlyDate(selectedDate)}</strong>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Info className="h-4 w-4 text-primary/70 shrink-0" />
            <span>Click any active date above to choose your booking date</span>
          </div>
        )}
      </div>
    </div>
  );
}
