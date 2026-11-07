import type { Booking } from "./supabase";

export const BUSINESS_START_HOUR = 8;
export const BUSINESS_END_HOUR = 22;
export const BUSINESS_SLOT_INTERVAL_MINUTES = 60;
export const ALL_DAY_BLOCK = "__ALL_DAY__";

export const DEFAULT_WORKING_TIME_SLOTS = buildWorkingTimeSlots();

export type DayScheduleMap = Record<string, string[]>;

const SCHEDULE_STORAGE_KEY = "elektrotehnik-schedule-v1";

export function buildWorkingTimeSlots(
  startHour = BUSINESS_START_HOUR,
  endHour = BUSINESS_END_HOUR,
): string[] {
  const slots: string[] = [];

  for (let hour = startHour; hour < endHour; hour += 1) {
    slots.push(`${String(hour).padStart(2, "0")}:00`);
  }

  return slots;
}

export function normalizeScheduleEntry(slots: unknown): string[] {
  if (!Array.isArray(slots)) return [];

  const normalized = new Set<string>();

  for (const slot of slots) {
    if (typeof slot !== "string") continue;

    const trimmed = slot.trim();
    if (!trimmed) continue;

    if (trimmed === ALL_DAY_BLOCK) {
      normalized.add(trimmed);
      continue;
    }

    if (DEFAULT_WORKING_TIME_SLOTS.includes(trimmed)) {
      normalized.add(trimmed);
    }
  }

  return Array.from(normalized);
}

export function loadBlockedTimeSlots(): DayScheduleMap {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as DayScheduleMap;
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed).map(([date, slots]) => [
        date,
        normalizeScheduleEntry(slots),
      ]),
    );
  } catch {
    return {};
  }
}

export function saveBlockedTimeSlots(schedule: DayScheduleMap) {
  if (typeof window === "undefined") return;

  try {
    const normalized = Object.fromEntries(
      Object.entries(schedule).map(([date, slots]) => [
        date,
        normalizeScheduleEntry(slots),
      ]),
    );

    Object.entries(normalized).forEach(([date, slots]) => {
      if (!slots.length) delete normalized[date];
    });

    window.localStorage.setItem(
      SCHEDULE_STORAGE_KEY,
      JSON.stringify(normalized),
    );
  } catch {
    // Ignore storage failures silently.
  }
}

export function getBlockedSlotsForDate(
  date: string,
  schedule: DayScheduleMap = loadBlockedTimeSlots(),
): string[] {
  if (!date) return [];

  const slots = normalizeScheduleEntry(schedule[date]);
  if (slots.includes(ALL_DAY_BLOCK)) {
    return [...DEFAULT_WORKING_TIME_SLOTS];
  }

  return Array.from(
    new Set(slots.filter((slot) => DEFAULT_WORKING_TIME_SLOTS.includes(slot))),
  );
}

export function isDateFullyBlocked(
  date: string,
  schedule: DayScheduleMap = loadBlockedTimeSlots(),
): boolean {
  if (!date) return false;
  const blocked = getBlockedSlotsForDate(date, schedule);
  return blocked.length === DEFAULT_WORKING_TIME_SLOTS.length;
}

export function getAvailableTimeSlotsForDate(
  date: string,
  bookings: Booking[] = [],
  schedule: DayScheduleMap = loadBlockedTimeSlots(),
): string[] {
  if (!date) return DEFAULT_WORKING_TIME_SLOTS;

  if (isDateFullyBlocked(date, schedule)) {
    return [];
  }

  const blocked = new Set(getBlockedSlotsForDate(date, schedule));
  const booked = new Set(
    bookings
      .filter(
        (booking) => booking.date === date && booking.status !== "cancelled",
      )
      .map((booking) => booking.time)
      .filter((slot) => DEFAULT_WORKING_TIME_SLOTS.includes(slot)),
  );

  return DEFAULT_WORKING_TIME_SLOTS.filter(
    (slot) => !blocked.has(slot) && !booked.has(slot),
  );
}

export function getDayScheduleSummary(
  date: string,
  bookings: Booking[] = [],
  schedule: DayScheduleMap = loadBlockedTimeSlots(),
) {
  const blocked = getBlockedSlotsForDate(date, schedule);
  const booked = Array.from(
    new Set(
      bookings
        .filter(
          (booking) => booking.date === date && booking.status !== "cancelled",
        )
        .map((booking) => booking.time)
        .filter((slot) => DEFAULT_WORKING_TIME_SLOTS.includes(slot)),
    ),
  );
  const available = DEFAULT_WORKING_TIME_SLOTS.filter(
    (slot) => !blocked.includes(slot) && !booked.includes(slot),
  );

  return { blocked, booked, available };
}

export function formatLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseDateKey(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDaysToDate(date: string, days: number): string {
  const parsed = parseDateKey(date);
  parsed.setDate(parsed.getDate() + days);
  return formatLocalDateKey(parsed);
}

export function getDateRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return [];

  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  const diff = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  const range: string[] = [];
  const totalSteps = Math.max(0, Math.abs(diff));

  for (let step = 0; step <= totalSteps; step += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + step * (diff >= 0 ? 1 : -1));
    range.push(formatLocalDateKey(current));
  }

  return range;
}

export function setDateRangeBlocked(
  schedule: DayScheduleMap,
  startDate: string,
  endDate: string,
): DayScheduleMap {
  if (!startDate || !endDate) return schedule;

  const updated = { ...schedule };
  const range = getDateRange(startDate, endDate);

  for (const date of range) {
    updated[date] = [ALL_DAY_BLOCK];
  }

  return updated;
}

export function copyBlockedDayToDate(
  schedule: DayScheduleMap,
  sourceDate: string,
  targetDate: string,
): DayScheduleMap {
  if (!sourceDate || !targetDate || sourceDate === targetDate) {
    return schedule;
  }

  const updated = { ...schedule };
  const sourceSlots = normalizeScheduleEntry(updated[sourceDate]);

  if (sourceSlots.length === 0) {
    delete updated[targetDate];
    return updated;
  }

  updated[targetDate] = [...sourceSlots];
  return updated;
}

export function generateCalendarDays(daysAhead = 28): string[] {
  const dates: string[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(start);
  startOfWeek.setDate(start.getDate() - start.getDay());

  const totalDays = Math.max(7, Math.ceil(daysAhead / 7) * 7);

  for (let i = 0; i < totalDays; i += 1) {
    const current = new Date(startOfWeek);
    current.setDate(startOfWeek.getDate() + i);
    dates.push(formatLocalDateKey(current));
  }

  return dates;
}

export function getTodayDateKey(): string {
  return formatLocalDateKey();
}

export function getLocalDateFromKey(date: string): Date {
  return parseDateKey(date);
}

export type BookingFormValues = {
  name: string;
  phone: string;
  email: string;
  service: string;
  date: string;
  message: string;
  attachmentIds?: string[]; // IDs of uploaded files
};

export function createEmptyBookingForm(): BookingFormValues {
  return {
    name: "",
    phone: "",
    email: "",
    service: "",
    date: "",
    message: "",
    attachmentIds: [],
  };
}

export function hasRequiredBookingFields(
  form: BookingFormValues,
  selectedTime: string,
): boolean {
  return (
    !!form.name.trim() &&
    !!form.phone.trim() &&
    !!form.service.trim() &&
    !!form.date.trim() &&
    !!selectedTime.trim()
  );
}
