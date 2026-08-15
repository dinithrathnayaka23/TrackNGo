import {
  FRESH_WINDOW_MS,
  MARKER_TRANSITION_MS,
  STALE_AFTER_MS,
  boardingEligibility,
  confidencePercent,
  distanceAlongRoute,
  distanceKm,
  distanceMeters,
  findClosestPointOnRoute,
  formatFixAge,
  interpolatePosition,
  parseJourneyDateTime,
  projectPointOnSegment,
  shouldApplyFix,
  snapToRoute,
  trackingFreshness,
  type LatLng,
} from "../../utils/liveTracking";

/* A reference point in Colombo. 0.001 degrees of latitude is ~111 m. */
const LAT = 6.9271;
const LON = 79.8612;

const at = (dLat: number, dLon = 0): LatLng => ({
  latitude: LAT + dLat,
  longitude: LON + dLon,
});

/* A straight north-bound route roughly 444 m long, in four legs. */
const ROUTE: LatLng[] = [at(0), at(0.001), at(0.002), at(0.003), at(0.004)];

describe("distance", () => {
  it("measures 0.001 degrees of latitude as about 111 metres", () => {
    expect(distanceMeters(at(0), at(0.001))).toBeCloseTo(111, 0);
  });

  it("reports the same distance in kilometres", () => {
    expect(distanceKm(at(0), at(0.001))).toBeCloseTo(0.111, 3);
  });

  it("is zero for the same point", () => {
    expect(distanceMeters(at(0), at(0))).toBe(0);
  });
});

describe("projectPointOnSegment", () => {
  it("projects a point beside the segment onto its midpoint", () => {
    const result = projectPointOnSegment(at(0), at(0.002), at(0.001, 0.0005));

    expect(result.fraction).toBeCloseTo(0.5, 2);
    expect(result.closest.latitude).toBeCloseTo(LAT + 0.001, 5);
  });

  it("clamps a point beyond the end back onto the segment", () => {
    const result = projectPointOnSegment(at(0), at(0.001), at(0.005));

    expect(result.fraction).toBe(1);
    expect(result.closest.latitude).toBeCloseTo(LAT + 0.001, 6);
  });

  it("handles a zero-length segment without dividing by zero", () => {
    const result = projectPointOnSegment(at(0), at(0), at(0.001));

    expect(result.fraction).toBe(0);
    expect(result.closest).toEqual(at(0));
  });
});

describe("findClosestPointOnRoute", () => {
  it("finds the nearest segment and how far off the route the point is", () => {
    /* ~55 m east of the route, level with the third stop. */
    const result = findClosestPointOnRoute(ROUTE, at(0.002, 0.0005));

    expect(result.index).toBe(1);
    expect(result.distanceMeters).toBeCloseTo(55, -1);
  });

  it("falls back gracefully on an empty or single-point route", () => {
    expect(findClosestPointOnRoute([], at(0)).point).toEqual(at(0));
    expect(findClosestPointOnRoute([at(0.003)], at(0)).point).toEqual(at(0.003));
  });
});

describe("confidencePercent", () => {
  it("holds the full score inside the fresh window", () => {
    expect(confidencePercent(100, 0)).toBe(100);
    expect(confidencePercent(100, FRESH_WINDOW_MS)).toBe(100);
    expect(confidencePercent(80, 3_000)).toBe(80);
  });

  it("decays as the fix ages", () => {
    const at12s = confidencePercent(100, 12_000);
    const at20s = confidencePercent(100, 20_000);

    expect(at12s).toBeLessThan(100);
    expect(at20s).toBeLessThan(at12s);
  });

  it("hits zero once the fix is stale", () => {
    expect(confidencePercent(100, STALE_AFTER_MS)).toBe(0);
    expect(confidencePercent(100, 120_000)).toBe(0);
  });

  it("clamps a nonsense quality score into range", () => {
    expect(confidencePercent(140, 0)).toBe(100);
    expect(confidencePercent(-20, 0)).toBe(0);
  });

  it("matches the server's decay curve at 12 seconds", () => {
    /* The Java service uses the same formula; both must agree or the badge
       would jump between a WebSocket push and a REST refresh. */
    expect(confidencePercent(100, 12_000)).toBe(72);
  });
});

describe("trackingFreshness", () => {
  it("calls a recent fix live, a lagging one delayed, and an old one lost", () => {
    expect(trackingFreshness(2_000)).toBe("live");
    expect(trackingFreshness(15_000)).toBe("delayed");
    expect(trackingFreshness(45_000)).toBe("lost");
  });
});

describe("formatFixAge", () => {
  it("reads naturally across the ranges a rider will see", () => {
    expect(formatFixAge(500)).toBe("just now");
    expect(formatFixAge(8_000)).toBe("8s ago");
    expect(formatFixAge(180_000)).toBe("3 min ago");
    expect(formatFixAge(7_200_000)).toBe("2h ago");
  });
});

describe("shouldApplyFix", () => {
  const fix = (timestamp: number, dLat = 0) => ({
    ...at(dLat),
    timestamp,
  });

  it("accepts the first fix", () => {
    expect(shouldApplyFix(null, fix(1000))).toBe(true);
  });

  it("accepts a newer fix", () => {
    expect(shouldApplyFix(fix(1000), fix(2000, 0.001))).toBe(true);
  });

  it("rejects a fix older than the one on screen", () => {
    expect(shouldApplyFix(fix(2000), fix(1000, 0.001))).toBe(false);
  });

  it("rejects a redelivered copy of the fix already on screen", () => {
    expect(shouldApplyFix(fix(2000), fix(2000))).toBe(false);
  });

  it("rejects nothing and rejects broken coordinates", () => {
    expect(shouldApplyFix(fix(1000), null)).toBe(false);
    expect(
      shouldApplyFix(fix(1000), {
        latitude: NaN,
        longitude: LON,
        timestamp: 2000,
      }),
    ).toBe(false);
  });
});

describe("interpolatePosition", () => {
  const from = at(0);
  const to = at(0.001);

  it("sits on the old position before the slide starts", () => {
    expect(interpolatePosition(from, to, 0)).toEqual(from);
  });

  it("lands exactly on the new position when the slide ends", () => {
    expect(interpolatePosition(from, to, MARKER_TRANSITION_MS)).toEqual(to);
    expect(interpolatePosition(from, to, MARKER_TRANSITION_MS * 5)).toEqual(to);
  });

  it("moves monotonically towards the target", () => {
    const quarter = interpolatePosition(from, to, MARKER_TRANSITION_MS * 0.25);
    const half = interpolatePosition(from, to, MARKER_TRANSITION_MS * 0.5);

    expect(quarter.latitude).toBeGreaterThan(from.latitude);
    expect(half.latitude).toBeGreaterThan(quarter.latitude);
    expect(half.latitude).toBeLessThan(to.latitude);
  });

  it("eases out, covering more than half the distance by the halfway point", () => {
    const half = interpolatePosition(from, to, MARKER_TRANSITION_MS * 0.5);
    const progress = (half.latitude - from.latitude) / (to.latitude - from.latitude);

    expect(progress).toBeGreaterThan(0.5);
  });
});

describe("snapToRoute", () => {
  it("pulls a fix that is just off the road onto the route", () => {
    /* ~11 m east of the line, with an 11 m accuracy radius. */
    const result = snapToRoute(at(0.0015, 0.0001), ROUTE, 11);

    expect(result.snapped).toBe(true);
    expect(result.position.longitude).toBeCloseTo(LON, 6);
  });

  it("leaves a genuinely off-route bus where GPS put it", () => {
    /* ~550 m east of the route with a precise 5 m fix: the bus really has
       left the route, and hiding that would mislead the passenger. */
    const point = at(0.0015, 0.005);
    const result = snapToRoute(point, ROUTE, 5);

    expect(result.snapped).toBe(false);
    expect(result.position).toEqual(point);
    expect(result.offRouteMeters).toBeGreaterThan(400);
  });

  it("snaps further when the fix itself is coarse", () => {
    /* ~44 m off the route. A 5 m fix means the bus is really there; a 50 m
       fix means the road is well inside the margin of error. */
    const point = at(0.0015, 0.0004);

    expect(snapToRoute(point, ROUTE, 5).snapped).toBe(false);
    expect(snapToRoute(point, ROUTE, 50).snapped).toBe(true);
  });

  it("never snaps beyond the hard ceiling, however coarse the fix", () => {
    /* ~99 m off the route with a hopeless 500 m accuracy radius. */
    const result = snapToRoute(at(0.0015, 0.0009), ROUTE, 500);

    expect(result.snapped).toBe(false);
  });

  it("passes the point through when there is no route to snap to", () => {
    const point = at(0.001);

    expect(snapToRoute(point, [], 5).position).toEqual(point);
    expect(snapToRoute(point, [at(0)], 5).snapped).toBe(false);
  });
});

describe("boardingEligibility", () => {
  /* 15 Aug 2026, 09:30 local — matching the scenario in the screenshot. */
  const now = new Date(2026, 7, 15, 9, 30);

  it("blocks boarding a trip booked for tomorrow", () => {
    const result = boardingEligibility({
      journeyDate: "2026-08-16",
      journeyTime: "08:00",
      busIsLive: true,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("This trip is on");
  });

  it("blocks boarding hours before today's departure", () => {
    const result = boardingEligibility({
      journeyDate: "2026-08-15",
      journeyTime: "18:00",
      busIsLive: true,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Boarding opens at");
  });

  it("allows boarding inside the window before departure", () => {
    const result = boardingEligibility({
      journeyDate: "2026-08-15",
      journeyTime: "09:45",
      busIsLive: true,
      now,
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("allows boarding a trip already under way", () => {
    const result = boardingEligibility({
      journeyDate: "2026-08-15",
      journeyTime: "08:00",
      busIsLive: true,
      now,
    });

    expect(result.allowed).toBe(true);
  });

  it("blocks boarding a trip that finished long ago", () => {
    const result = boardingEligibility({
      journeyDate: "2026-08-14",
      journeyTime: "08:00",
      busIsLive: true,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("already finished");
  });

  it("blocks boarding while the bus is not sharing its location", () => {
    const result = boardingEligibility({
      journeyDate: "2026-08-15",
      journeyTime: "09:45",
      busIsLive: false,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("sharing its location");
  });

  it("falls back to the live-bus check when the booking carries no date", () => {
    expect(boardingEligibility({ busIsLive: true, now }).allowed).toBe(true);
    expect(boardingEligibility({ busIsLive: false, now }).allowed).toBe(false);
  });

  it("reads the journey date in local time, not UTC", () => {
    /* new Date("2026-08-16") parses as UTC midnight, which in Sri Lanka is
       the evening of the 15th — that would open boarding a day early, the
       exact bug this guards against. */
    const parsed = parseJourneyDateTime("2026-08-16", "08:00")!;

    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(16);
    expect(parsed.getHours()).toBe(8);
  });

  it("tolerates a seconds component and a missing time", () => {
    expect(parseJourneyDateTime("2026-08-16", "08:00:00")!.getHours()).toBe(8);
    expect(parseJourneyDateTime("2026-08-16")!.getHours()).toBe(0);
    expect(parseJourneyDateTime(null)).toBeNull();
    expect(parseJourneyDateTime("not-a-date")).toBeNull();
  });
});

describe("distanceAlongRoute", () => {
  it("measures along the route rather than as the crow flies", () => {
    /* From the first stop to the last: four legs of ~111 m. */
    const result = distanceAlongRoute(ROUTE, at(0), ROUTE.length - 1);

    expect(result).toBeCloseTo(0.444, 2);
  });

  it("shrinks as the bus advances", () => {
    const early = distanceAlongRoute(ROUTE, at(0.0005), 4)!;
    const later = distanceAlongRoute(ROUTE, at(0.0025), 4)!;

    expect(later).toBeLessThan(early);
  });

  it("returns zero once the bus has passed the destination", () => {
    expect(distanceAlongRoute(ROUTE, at(0.0035), 1)).toBe(0);
  });

  it("returns null when there is no usable route or destination", () => {
    expect(distanceAlongRoute([at(0)], at(0), 0)).toBeNull();
    expect(distanceAlongRoute(ROUTE, at(0), -1)).toBeNull();
  });
});
