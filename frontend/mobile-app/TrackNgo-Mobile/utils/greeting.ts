import { useEffect, useState } from "react";

/**
 * Hours at which the greeting label changes. Used both to pick the greeting and
 * to schedule the refresh that flips it while a screen stays open.
 */
export const GREETING_BOUNDARY_HOURS = [5, 12, 17, 21, 24];

export type Greeting =
  | "Good Morning"
  | "Good Afternoon"
  | "Good Evening"
  | "Good Night";

/**
 * Returns a time-appropriate greeting for the given moment.
 *   05:00–11:59 → Good Morning
 *   12:00–16:59 → Good Afternoon
 *   17:00–20:59 → Good Evening
 *   21:00–04:59 → Good Night
 */
export function getGreetingForTime(date: Date = new Date()): Greeting {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
}

/**
 * Milliseconds until the next greeting boundary, so a screen that is left open
 * across (say) noon updates itself instead of showing a stale greeting.
 */
export function millisUntilNextGreetingBoundary(from: Date = new Date()): number {
  const currentHour = from.getHours();
  const nextHour = GREETING_BOUNDARY_HOURS.find((hour) => hour > currentHour) ?? 24;
  const nextBoundary = new Date(from);
  nextBoundary.setHours(nextHour, 0, 0, 0);
  return Math.max(nextBoundary.getTime() - from.getTime(), 500);
}

/**
 * Greeting for the current time that re-renders itself at each boundary.
 */
export function useTimeOfDayGreeting(): Greeting {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timeoutId = setTimeout(() => setNow(new Date()), millisUntilNextGreetingBoundary(now));
    return () => clearTimeout(timeoutId);
  }, [now]);

  return getGreetingForTime(now);
}
