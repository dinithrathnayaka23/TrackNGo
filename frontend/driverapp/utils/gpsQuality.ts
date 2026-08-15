/**
 * GPS quality pipeline for the driver app.
 *
 * A phone's raw GPS stream is noisy. Even with a clear sky view the reported
 * position wanders by several metres while the bus is parked, and the first
 * fixes after a tunnel, a covered bus stand, or an app resume can be hundreds
 * of metres out. Publishing that stream straight to passengers makes the bus
 * marker twitch and occasionally teleport.
 *
 * Everything here is pure so it can be unit tested without a device: the
 * dashboard feeds each `expo-location` reading through `GpsTracker`, which
 * decides whether the fix is worth publishing and smooths the ones that are.
 */

/* ── Tunables ─────────────────────────────────────────────── */

/** Fixes less precise than this are not worth sending. Matches the server. */
export const MAX_ACCURACY_METERS = 100;

/** A fix at or below this accuracy radius scores 100%. */
export const EXCELLENT_ACCURACY_METERS = 5;

/** 45 m/s is 162 km/h - faster than any bus, so it means a bad fix. */
export const MAX_PLAUSIBLE_SPEED_MPS = 45;

/**
 * Below this movement we treat the bus as parked. GPS scatter alone routinely
 * produces 2-4 m of apparent movement, so publishing every wobble would burn
 * battery and data to tell passengers nothing.
 */
export const MIN_PUBLISH_DISTANCE_METERS = 8;

/** Publish at least this often even when parked, so the fix never goes stale. */
export const HEARTBEAT_INTERVAL_MS = 10_000;

/** Ignore a reading the OS hands us that is older than this. */
export const MAX_FIX_AGE_MS = 15_000;

/** Movement below this distance produces a meaningless bearing. */
const MIN_HEADING_DISTANCE_METERS = 5;

const EARTH_RADIUS_METERS = 6_371_008.8;

/* ── Types ────────────────────────────────────────────────── */

export interface GpsFix {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy radius in metres, if the device reported one. */
  accuracy?: number | null;
  /** Ground speed in metres per second, if the device reported one. */
  speed?: number | null;
  /** Degrees clockwise from true north, if the device reported one. */
  heading?: number | null;
  /** Epoch milliseconds the fix was taken. */
  timestamp: number;
}

export type RejectionReason =
  | "invalid-coordinates"
  | "no-fix"
  | "accuracy-too-low"
  | "stale-reading"
  | "out-of-order"
  | "implausible-jump"
  | "not-moved";

export interface AcceptedFix extends GpsFix {
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  /** Quality of the fix, 0-100, derived from the accuracy radius. */
  accuracyPercent: number;
}

export type GpsDecision =
  | { publish: true; fix: AcceptedFix }
  | { publish: false; reason: RejectionReason };

/* ── Geometry ─────────────────────────────────────────────── */

/** Great-circle distance between two coordinates, in metres. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Initial bearing from point 1 to point 2, in degrees clockwise from north. */
export function bearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/* ── Scoring ──────────────────────────────────────────────── */

/**
 * Map an accuracy radius in metres onto a 0-100 score, on a log scale because
 * that is how accuracy is experienced: 5 m versus 10 m changes which side of a
 * road the bus appears on, while 80 m versus 85 m changes nothing.
 *
 * Kept identical to the server's `LiveLocationQualityService.accuracyPercent`
 * so the driver and the passenger see the same number for the same fix.
 */
export function accuracyPercent(accuracyMeters?: number | null): number {
  if (
    accuracyMeters == null ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters < 0
  ) {
    return 50;
  }
  if (accuracyMeters <= EXCELLENT_ACCURACY_METERS) return 100;
  if (accuracyMeters >= MAX_ACCURACY_METERS) return 0;

  const span = Math.log(MAX_ACCURACY_METERS / EXCELLENT_ACCURACY_METERS);
  const used = Math.log(accuracyMeters / EXCELLENT_ACCURACY_METERS);
  return Math.round(100 * (1 - used / span));
}

/** Human-readable band for the accuracy score, for the driver's status chip. */
export function accuracyLabel(percent: number): string {
  if (percent >= 85) return "Excellent";
  if (percent >= 65) return "Good";
  if (percent >= 40) return "Fair";
  return "Weak";
}

/* ── Smoothing ────────────────────────────────────────────── */

/**
 * Kalman filter over latitude and longitude with adaptive process noise.
 *
 * The idea: keep a running estimate of the position along with how uncertain
 * that estimate is (`variance`, in metres squared). Between fixes the
 * uncertainty grows in proportion to how long it has been and how far the bus
 * could have travelled. When a new fix arrives, blend it into the estimate in
 * proportion to how confident each side is - a 4 m fix mostly overwrites the
 * estimate, a 40 m fix barely nudges it.
 *
 * The process noise has to adapt, and this is the part that matters. A filter
 * tuned to hold a parked bus still will lag tens of metres behind a bus doing
 * 80 km/h, because it keeps insisting the bus is near where it last was. So we
 * estimate how fast the bus is actually moving from the raw fixes themselves
 * and widen the process noise to match: heavy smoothing when parked, where the
 * signal is all jitter, and almost none at speed, where real movement dwarfs
 * the noise and the newest fix is the best answer available.
 *
 * The speed estimate discounts the accuracy radii of both fixes, so scatter
 * between two imprecise readings is not mistaken for the bus pulling away.
 */
export class GpsSmoother {
  /** Floor for process noise: how far a stopped bus could drift, m/s. */
  private readonly baseProcessNoiseMetersPerSecond: number;

  private latitude = 0;
  private longitude = 0;
  private variance = -1;
  private timestamp = 0;

  /** Last raw measurement, used to estimate speed independently of the estimate. */
  private lastMeasurement: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  } | null = null;

  constructor(baseProcessNoiseMetersPerSecond = 3) {
    this.baseProcessNoiseMetersPerSecond = baseProcessNoiseMetersPerSecond;
  }

  get initialised(): boolean {
    return this.variance >= 0;
  }

  /** Feed in a fix and get back the smoothed position. */
  process(fix: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    timestamp: number;
  }): { latitude: number; longitude: number; accuracy: number } {
    /* An unreported accuracy is treated as mediocre rather than perfect, so an
       unknown-quality fix cannot yank the estimate around. */
    const accuracy =
      fix.accuracy != null && Number.isFinite(fix.accuracy) && fix.accuracy > 1
        ? fix.accuracy
        : 20;

    const measurement = {
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy,
      timestamp: fix.timestamp,
    };

    if (!this.initialised) {
      this.latitude = fix.latitude;
      this.longitude = fix.longitude;
      this.variance = accuracy * accuracy;
      this.timestamp = fix.timestamp;
      this.lastMeasurement = measurement;
      return { latitude: this.latitude, longitude: this.longitude, accuracy };
    }

    const processNoise = this.estimateProcessNoise(measurement);
    this.lastMeasurement = measurement;

    const elapsedMs = fix.timestamp - this.timestamp;
    if (elapsedMs > 0) {
      /* Prediction step: with no new information, confidence decays over time. */
      this.variance += (elapsedMs / 1000) * processNoise * processNoise;
      this.timestamp = fix.timestamp;
    }

    /* Update step: the Kalman gain is the share of the new fix we believe. */
    const gain = this.variance / (this.variance + accuracy * accuracy);
    this.latitude += gain * (fix.latitude - this.latitude);
    this.longitude += gain * (fix.longitude - this.longitude);
    this.variance *= 1 - gain;

    return {
      latitude: this.latitude,
      longitude: this.longitude,
      accuracy: Math.sqrt(this.variance),
    };
  }

  reset(): void {
    this.variance = -1;
    this.timestamp = 0;
    this.lastMeasurement = null;
  }

  /**
   * Process noise for this step: the greater of the parked-bus floor and the
   * bus's apparent ground speed, so the filter loosens exactly as fast as the
   * bus is actually moving.
   */
  private estimateProcessNoise(measurement: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  }): number {
    const previous = this.lastMeasurement;
    if (!previous) return this.baseProcessNoiseMetersPerSecond;

    const elapsedSeconds = (measurement.timestamp - previous.timestamp) / 1000;
    if (elapsedSeconds <= 0) return this.baseProcessNoiseMetersPerSecond;

    const gap = distanceMeters(
      previous.latitude,
      previous.longitude,
      measurement.latitude,
      measurement.longitude,
    );
    /* Two imprecise fixes taken in the same spot differ by tens of metres.
       Only the movement beyond that combined uncertainty is real. */
    const travelled = Math.max(0, gap - previous.accuracy - measurement.accuracy);
    const speed = Math.min(travelled / elapsedSeconds, MAX_PLAUSIBLE_SPEED_MPS);

    return Math.max(this.baseProcessNoiseMetersPerSecond, speed);
  }
}

/* ── Tracker ──────────────────────────────────────────────── */

/**
 * Decides which raw fixes are worth publishing, and smooths the ones that are.
 *
 * Feed every reading from `Location.watchPositionAsync` into `accept()`. Fixes
 * that are impossible, imprecise, or indistinguishable from the last published
 * position are rejected with a reason; everything else comes back smoothed and
 * scored, ready to POST.
 */
export class GpsTracker {
  private readonly smoother: GpsSmoother;
  private lastAccepted: AcceptedFix | null = null;
  private lastPublishedAt = 0;

  constructor(processNoiseMetersPerSecond = 3) {
    this.smoother = new GpsSmoother(processNoiseMetersPerSecond);
  }

  /** The most recent fix this tracker published, if any. */
  get current(): AcceptedFix | null {
    return this.lastAccepted;
  }

  accept(raw: GpsFix, now: number = Date.now()): GpsDecision {
    const { latitude, longitude } = raw;

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return { publish: false, reason: "invalid-coordinates" };
    }

    /* (0, 0) is what a device reports when it has no fix at all. */
    if (latitude === 0 && longitude === 0) {
      return { publish: false, reason: "no-fix" };
    }

    if (raw.timestamp > 0 && now - raw.timestamp > MAX_FIX_AGE_MS) {
      return { publish: false, reason: "stale-reading" };
    }

    const accuracy =
      raw.accuracy != null && Number.isFinite(raw.accuracy) && raw.accuracy >= 0
        ? raw.accuracy
        : null;

    if (accuracy != null && accuracy > MAX_ACCURACY_METERS) {
      return { publish: false, reason: "accuracy-too-low" };
    }

    const previous = this.lastAccepted;
    if (previous) {
      if (raw.timestamp < previous.timestamp) {
        return { publish: false, reason: "out-of-order" };
      }

      const gap = distanceMeters(
        previous.latitude,
        previous.longitude,
        latitude,
        longitude,
      );
      const elapsedSeconds = (raw.timestamp - previous.timestamp) / 1000;

      if (elapsedSeconds > 0) {
        /* Discount the accuracy radii of both fixes: two imprecise readings
           taken in the same spot legitimately differ by tens of metres, and
           that difference is not movement. */
        const slack = (accuracy ?? 0) + (previous.accuracy ?? 0);
        const travelled = Math.max(0, gap - slack);
        if (travelled / elapsedSeconds > MAX_PLAUSIBLE_SPEED_MPS) {
          return { publish: false, reason: "implausible-jump" };
        }
      }
    }

    const smoothed = this.smoother.process({
      latitude,
      longitude,
      accuracy,
      timestamp: raw.timestamp,
    });

    /* Rate limiting comes last so the smoother still sees every good fix - the
       readings we skip publishing still sharpen the position estimate. */
    if (previous) {
      const moved = distanceMeters(
        previous.latitude,
        previous.longitude,
        smoothed.latitude,
        smoothed.longitude,
      );
      const sinceLastPublish = now - this.lastPublishedAt;
      if (
        moved < MIN_PUBLISH_DISTANCE_METERS &&
        sinceLastPublish < HEARTBEAT_INTERVAL_MS
      ) {
        return { publish: false, reason: "not-moved" };
      }
    }

    const fix: AcceptedFix = {
      latitude: smoothed.latitude,
      longitude: smoothed.longitude,
      accuracy,
      speed: resolveSpeed(raw, previous, smoothed),
      heading: resolveHeading(raw, previous, smoothed),
      timestamp: raw.timestamp > 0 ? raw.timestamp : now,
      accuracyPercent: accuracyPercent(accuracy),
    };

    this.lastAccepted = fix;
    this.lastPublishedAt = now;
    return { publish: true, fix };
  }

  /**
   * The fix to republish when the OS has gone quiet, or null if nothing is due.
   *
   * A parked bus produces no new readings at all - the OS only wakes us when
   * something changes - so without this the last fix would simply age out and
   * passengers would be told the signal was lost while the bus sat at a stop
   * with a perfect view of the sky. Resending the last known position keeps it
   * marked live for as long as the bus is genuinely there.
   */
  heartbeat(now: number = Date.now()): AcceptedFix | null {
    if (!this.lastAccepted) return null;
    if (now - this.lastPublishedAt < HEARTBEAT_INTERVAL_MS) return null;

    this.lastPublishedAt = now;
    /* Restamp it: the position is still current, only the reading is old. */
    this.lastAccepted = { ...this.lastAccepted, timestamp: now };
    return this.lastAccepted;
  }

  reset(): void {
    this.smoother.reset();
    this.lastAccepted = null;
    this.lastPublishedAt = 0;
  }
}

/**
 * Phones report a negative speed when they cannot measure one, so fall back to
 * the distance covered since the last published fix.
 */
function resolveSpeed(
  raw: GpsFix,
  previous: AcceptedFix | null,
  smoothed: { latitude: number; longitude: number },
): number | null {
  if (raw.speed != null && Number.isFinite(raw.speed) && raw.speed >= 0) {
    return raw.speed;
  }
  if (!previous) return null;

  const elapsedSeconds = (raw.timestamp - previous.timestamp) / 1000;
  if (elapsedSeconds <= 0) return null;

  const derived =
    distanceMeters(
      previous.latitude,
      previous.longitude,
      smoothed.latitude,
      smoothed.longitude,
    ) / elapsedSeconds;
  return derived > MAX_PLAUSIBLE_SPEED_MPS ? null : derived;
}

/**
 * Phones report a negative heading when stationary or when the device has no
 * compass fix. Deriving a bearing from two fixes only works once the bus has
 * actually moved, so below that threshold we hold the previous heading rather
 * than spinning the marker on the passenger's map.
 */
function resolveHeading(
  raw: GpsFix,
  previous: AcceptedFix | null,
  smoothed: { latitude: number; longitude: number },
): number | null {
  if (
    raw.heading != null &&
    Number.isFinite(raw.heading) &&
    raw.heading >= 0 &&
    raw.heading <= 360
  ) {
    return raw.heading % 360;
  }
  if (!previous) return null;

  const moved = distanceMeters(
    previous.latitude,
    previous.longitude,
    smoothed.latitude,
    smoothed.longitude,
  );
  if (moved < MIN_HEADING_DISTANCE_METERS) return previous.heading;

  return bearingDegrees(
    previous.latitude,
    previous.longitude,
    smoothed.latitude,
    smoothed.longitude,
  );
}
