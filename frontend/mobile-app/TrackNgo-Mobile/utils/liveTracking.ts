/**
 * Live-tracking maths for the passenger map.
 *
 * The bus marker a passenger sees is not the raw GPS fix. A fix arrives every
 * few seconds, is accurate to a handful of metres at best, and lands wherever
 * the satellites say - which is regularly inside a building beside the road.
 * Dropping the marker straight onto each fix produces a dot that teleports
 * every few seconds and spends half its time off the road.
 *
 * These helpers close that gap: they score how much the fix can be trusted,
 * slide the marker between fixes instead of jumping, and pull the marker onto
 * the route when the fix is close enough that the bus is certainly on it.
 *
 * Everything here is pure so it can be unit tested without a map or a device.
 */

const EARTH_RADIUS_METERS = 6_371_008.8;

/** Fixes older than this no longer describe where the bus is. Matches the server. */
export const STALE_AFTER_MS = 30_000;

/** Confidence holds at full strength until a fix is older than this. */
export const FRESH_WINDOW_MS = 5_000;

/** How long the marker takes to slide from one fix to the next, in ms. */
export const MARKER_TRANSITION_MS = 1_200;

/** Never snap a bus further than this onto the route, however coarse the fix. */
export const MAX_SNAP_DISTANCE_METERS = 60;

export interface LatLng {
  latitude: number;
  longitude: number;
}

/* ── Geometry ─────────────────────────────────────────────── */

/** Great-circle distance between two coordinates, in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Great-circle distance in kilometres, for distance and ETA display. */
export function distanceKm(a: LatLng, b: LatLng): number {
  return distanceMeters(a, b) / 1000;
}

/**
 * Projects point `p` onto the segment `a`-`b`, clamped to the segment's ends.
 * Returns how far along the segment the projection falls (0 to 1) and where.
 */
export function projectPointOnSegment(
  a: LatLng,
  b: LatLng,
  p: LatLng,
): { fraction: number; closest: LatLng } {
  const dx = b.latitude - a.latitude;
  const dy = b.longitude - a.longitude;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return { fraction: 0, closest: a };

  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.latitude - a.latitude) * dx + (p.longitude - a.longitude) * dy) /
        lengthSquared,
    ),
  );
  return {
    fraction: t,
    closest: {
      latitude: a.latitude + t * dx,
      longitude: a.longitude + t * dy,
    },
  };
}

/**
 * Finds the point on a multi-segment route closest to `point`, by checking
 * every segment and keeping the best.
 */
export function findClosestPointOnRoute(
  route: LatLng[],
  point: LatLng,
): { index: number; fraction: number; point: LatLng; distanceMeters: number } {
  if (route.length === 0) {
    return { index: 0, fraction: 0, point, distanceMeters: 0 };
  }
  if (route.length === 1) {
    return {
      index: 0,
      fraction: 0,
      point: route[0],
      distanceMeters: distanceMeters(route[0], point),
    };
  }

  let best = {
    index: 0,
    fraction: 0,
    point: route[0],
    distanceMeters: Infinity,
  };

  for (let i = 0; i < route.length - 1; i++) {
    const { fraction, closest } = projectPointOnSegment(
      route[i],
      route[i + 1],
      point,
    );
    const d = distanceMeters(closest, point);
    if (d < best.distanceMeters) {
      best = { index: i, fraction, point: closest, distanceMeters: d };
    }
  }

  return best;
}

/* ── Confidence ───────────────────────────────────────────── */

/**
 * Folds the age of a fix into its quality score.
 *
 * A pinpoint fix from 25 seconds ago is not a good answer to "where is the bus
 * now", so confidence holds at the fix's own quality for the first few seconds
 * and then falls to zero by the time the fix is stale.
 *
 * Kept identical to the server's `LiveLocationQualityService.confidencePercent`
 * so the badge does not jump when the app switches between the WebSocket
 * stream and a REST refresh.
 */
export function confidencePercent(
  accuracyPercent: number,
  ageMs: number,
): number {
  const quality = Math.max(0, Math.min(100, accuracyPercent));
  if (ageMs <= FRESH_WINDOW_MS) return quality;
  if (ageMs >= STALE_AFTER_MS) return 0;

  const decay =
    1 - (ageMs - FRESH_WINDOW_MS) / (STALE_AFTER_MS - FRESH_WINDOW_MS);
  return Math.round(quality * decay);
}

export type TrackingFreshness = "live" | "delayed" | "lost";

/** How the connection should be described to the passenger. */
export function trackingFreshness(ageMs: number): TrackingFreshness {
  if (ageMs <= FRESH_WINDOW_MS * 2) return "live";
  if (ageMs < STALE_AFTER_MS) return "delayed";
  return "lost";
}

/** Short caption for when the position was last updated. */
export function formatFixAge(ageMs: number): string {
  if (ageMs < 2_000) return "just now";
  const seconds = Math.round(ageMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

/* ── Boarding eligibility ─────────────────────────────────── */

/** How long before departure a passenger may mark themselves aboard. */
export const BOARDING_OPENS_BEFORE_MS = 30 * 60 * 1000;

/** How long after departure boarding stays available. */
export const BOARDING_CLOSES_AFTER_MS = 12 * 60 * 60 * 1000;

export interface BoardingEligibility {
  allowed: boolean;
  /** Why boarding is unavailable, phrased for the passenger. Null when allowed. */
  reason: string | null;
}

/**
 * Parses the journey date and time a booking carries.
 *
 * Dates arrive as `YYYY-MM-DD` and times as `HH:mm` or `HH:mm:ss`. Building the
 * Date from parts rather than letting the engine parse the string matters:
 * `new Date("2026-08-16")` is read as UTC and lands on the previous evening in
 * Sri Lanka, which would open boarding a day early - exactly the bug this
 * function exists to prevent.
 */
export function parseJourneyDateTime(
  journeyDate?: string | null,
  journeyTime?: string | null,
): Date | null {
  if (!journeyDate) return null;

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(journeyDate.trim());
  if (!dateMatch) return null;

  const [, year, month, day] = dateMatch;
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec((journeyTime ?? "").trim());
  const hours = timeMatch ? Number(timeMatch[1]) : 0;
  const minutes = timeMatch ? Number(timeMatch[2]) : 0;

  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    hours,
    minutes,
    0,
    0,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Formats a journey date for a "come back on..." message. */
function formatJourneyDay(when: Date): string {
  return when.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatJourneyTime(when: Date): string {
  return when.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Whether the passenger may declare themselves aboard this bus right now.
 *
 * Boarding drives real behaviour further down the app - it switches the ETA to
 * the passenger's drop-off, starts following the bus, and marks the seat as
 * occupied - so it has to mean "I am physically on this bus on this trip". A
 * booking for tomorrow can legitimately be tracked today (the same bus is out
 * running today's trip, and riders like to see it), but boarding it makes no
 * sense, and the app should say why rather than silently accepting it.
 *
 * The same rule covers every booking type - highway and long distance alike -
 * because it depends only on the journey time each booking already carries.
 */
export function boardingEligibility(params: {
  journeyDate?: string | null;
  journeyTime?: string | null;
  /** True when a recent fix for the bus is on screen. */
  busIsLive: boolean;
  now?: Date;
}): BoardingEligibility {
  const { journeyDate, journeyTime, busIsLive } = params;
  const now = params.now ?? new Date();

  const departure = parseJourneyDateTime(journeyDate, journeyTime);
  if (!departure) {
    /* No journey time to check against. Fall back to requiring a live bus
       rather than blocking a passenger over missing data. */
    return busIsLive
      ? { allowed: true, reason: null }
      : { allowed: false, reason: "Waiting for the bus to start sharing its location" };
  }

  const untilDeparture = departure.getTime() - now.getTime();

  if (untilDeparture > BOARDING_OPENS_BEFORE_MS) {
    const sameDay = departure.toDateString() === now.toDateString();
    return {
      allowed: false,
      reason: sameDay
        ? `Boarding opens at ${formatJourneyTime(
            new Date(departure.getTime() - BOARDING_OPENS_BEFORE_MS),
          )}`
        : `This trip is on ${formatJourneyDay(departure)}`,
    };
  }

  if (-untilDeparture > BOARDING_CLOSES_AFTER_MS) {
    return { allowed: false, reason: "This trip has already finished" };
  }

  if (!busIsLive) {
    return {
      allowed: false,
      reason: "Waiting for the bus to start sharing its location",
    };
  }

  return { allowed: true, reason: null };
}

/* ── Update filtering ─────────────────────────────────────── */

export interface TrackedFix extends LatLng {
  timestamp?: number | null;
}

/**
 * Whether a newly arrived fix should replace the one on screen.
 *
 * The WebSocket can redeliver a message, and a REST refresh can land after a
 * newer push has already arrived. Applying either would drag the marker
 * backwards along the route, which looks like the bus reversing.
 */
export function shouldApplyFix(
  current: TrackedFix | null,
  incoming: TrackedFix | null,
): boolean {
  if (!incoming) return false;
  if (
    !Number.isFinite(incoming.latitude) ||
    !Number.isFinite(incoming.longitude)
  ) {
    return false;
  }
  if (!current) return true;

  const currentTime = current.timestamp ?? 0;
  const incomingTime = incoming.timestamp ?? 0;
  if (incomingTime && currentTime && incomingTime < currentTime) return false;

  /* A repeat of the fix already on screen carries no new information. */
  if (
    incomingTime === currentTime &&
    incoming.latitude === current.latitude &&
    incoming.longitude === current.longitude
  ) {
    return false;
  }

  return true;
}

/* ── Marker movement ──────────────────────────────────────── */

/** Ease-out curve, so the marker starts moving briskly and settles gently. */
function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * Position of the marker part-way through its slide from one fix to the next.
 * `elapsedMs` is time since the new fix arrived; the marker reaches `to` after
 * `durationMs`.
 */
export function interpolatePosition(
  from: LatLng,
  to: LatLng,
  elapsedMs: number,
  durationMs: number = MARKER_TRANSITION_MS,
): LatLng {
  if (durationMs <= 0 || elapsedMs >= durationMs) return to;
  if (elapsedMs <= 0) return from;

  const t = easeOut(elapsedMs / durationMs);
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * t,
    longitude: from.longitude + (to.longitude - from.longitude) * t,
  };
}

/**
 * Pulls the bus onto the route line when the fix is close enough that the bus
 * must be on it.
 *
 * A 10 m fix beside a road is almost certainly a bus on that road, so drawing
 * it on the road is both prettier and more truthful than drawing it in the
 * building next door. The tolerance scales with the fix's own accuracy radius,
 * because that radius is exactly the distance the fix might be wrong by - a
 * 5 m fix that lands 50 m off the route is not a snapping error, it means the
 * bus has genuinely left the route (a diversion), and moving the marker would
 * hide that from the passenger.
 */
export function snapToRoute(
  point: LatLng,
  route: LatLng[],
  accuracyMeters?: number | null,
): { position: LatLng; snapped: boolean; offRouteMeters: number } {
  if (route.length < 2) {
    return { position: point, snapped: false, offRouteMeters: 0 };
  }

  const closest = findClosestPointOnRoute(route, point);
  const tolerance = Math.min(
    MAX_SNAP_DISTANCE_METERS,
    Math.max(15, accuracyMeters ?? 15),
  );

  if (closest.distanceMeters > tolerance) {
    return {
      position: point,
      snapped: false,
      offRouteMeters: closest.distanceMeters,
    };
  }

  return {
    position: closest.point,
    snapped: true,
    offRouteMeters: closest.distanceMeters,
  };
}

/**
 * Remaining distance in kilometres from the bus to a stop, measured along the
 * route rather than as the crow flies, so a winding road is not understated.
 * Returns 0 once the bus has passed the stop.
 */
export function distanceAlongRoute(
  route: LatLng[],
  bus: LatLng,
  destinationIndex: number,
): number | null {
  if (route.length < 2 || destinationIndex < 0) return null;

  const projection = findClosestPointOnRoute(route, bus);
  if (projection.index >= destinationIndex) return 0;

  let total = distanceKm(projection.point, route[projection.index + 1]);
  for (let i = projection.index + 1; i < destinationIndex; i++) {
    total += distanceKm(route[i], route[i + 1]);
  }
  return total;
}
