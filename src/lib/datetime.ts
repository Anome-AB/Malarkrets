/**
 * Helpers for splitting/combining the activity date and time-of-day across
 * the three <input type="date">/<input type="time"> fields used in the
 * new/edit activity forms. The server action still receives datetime-local
 * strings ("YYYY-MM-DDTHH:MM"); this module is the adapter.
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * "YYYY-MM-DD" in local time. Empty string for null/invalid dates so the
 * value is safe to pass directly into a controlled <input type="date">.
 */
export function toDateInput(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * "HH:MM" in local time. Empty string for null/invalid dates.
 */
export function toTimeInput(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/**
 * Combine a date-input value ("YYYY-MM-DD") and a time-input value ("HH:MM")
 * into a datetime-local string ("YYYY-MM-DDTHH:MM") — what the server action
 * expects to pass to `new Date()`. Returns null on invalid input.
 */
export function combineDateTime(
  date: string,
  timeOfDay: string,
): string | null {
  if (!date || !timeOfDay) return null;
  if (!DATE_RE.test(date) || !TIME_RE.test(timeOfDay)) return null;
  return `${date}T${timeOfDay}`;
}

/**
 * Combine end-of-day time with the activity date, handling overnight rollover.
 *
 * If the end time is earlier in the day than the start time (e.g. start
 * 22:00, end 01:00), the end is assumed to land on the next calendar day
 * — the common "kvällsaktivitet"-pattern. Activities that span more than
 * 24 hours are not covered; those need an explicit second date field which
 * we'll add later if the need shows up.
 *
 * Returns null when the end is empty (end is always optional).
 */
export function combineEndDateTime(
  date: string,
  startTimeOfDay: string,
  endTimeOfDay: string,
): string | null {
  if (!endTimeOfDay) return null;
  if (!DATE_RE.test(date) || !TIME_RE.test(endTimeOfDay)) return null;
  if (!startTimeOfDay || endTimeOfDay >= startTimeOfDay) {
    return `${date}T${endTimeOfDay}`;
  }
  // Overnight: push end to next local date.
  const d = new Date(`${date}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 1);
  const nextDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${nextDate}T${endTimeOfDay}`;
}
