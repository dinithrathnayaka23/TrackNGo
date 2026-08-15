import {
  GpsSmoother,
  GpsTracker,
  MAX_ACCURACY_METERS,
  accuracyLabel,
  accuracyPercent,
  bearingDegrees,
  distanceMeters,
  type GpsDecision,
  type GpsFix,
} from "../../utils/gpsQuality";

/* A reference point in Colombo. 0.001 degrees of latitude is ~111 m. */
const LAT = 6.9271;
const LON = 79.8612;
const T0 = 1_700_000_000_000;

function fix(overrides: Partial<GpsFix> = {}): GpsFix {
  return {
    latitude: LAT,
    longitude: LON,
    accuracy: 5,
    speed: null,
    heading: null,
    timestamp: T0,
    ...overrides,
  };
}

function published(decision: GpsDecision) {
  if (!decision.publish) {
    throw new Error(`expected the fix to be published, got: ${decision.reason}`);
  }
  return decision.fix;
}

describe("geometry helpers", () => {
  it("measures 0.001 degrees of latitude as about 111 metres", () => {
    expect(distanceMeters(LAT, LON, LAT + 0.001, LON)).toBeCloseTo(111, 0);
  });

  it("returns zero distance for the same point", () => {
    expect(distanceMeters(LAT, LON, LAT, LON)).toBe(0);
  });

  it("reports due north as 0 degrees and due east as 90", () => {
    expect(bearingDegrees(LAT, LON, LAT + 0.01, LON)).toBeCloseTo(0, 1);
    expect(bearingDegrees(LAT, LON, LAT, LON + 0.01)).toBeCloseTo(90, 1);
  });
});

describe("accuracyPercent", () => {
  it("scores a pinpoint fix at 100 and the cut-off at 0", () => {
    expect(accuracyPercent(3)).toBe(100);
    expect(accuracyPercent(5)).toBe(100);
    expect(accuracyPercent(MAX_ACCURACY_METERS)).toBe(0);
    expect(accuracyPercent(400)).toBe(0);
  });

  it("scores an unreported accuracy as 50", () => {
    expect(accuracyPercent(null)).toBe(50);
    expect(accuracyPercent(undefined)).toBe(50);
    expect(accuracyPercent(NaN)).toBe(50);
  });

  it("falls monotonically as the accuracy radius grows", () => {
    expect(accuracyPercent(10)).toBeGreaterThan(accuracyPercent(25));
    expect(accuracyPercent(25)).toBeGreaterThan(accuracyPercent(60));
  });

  it("matches the server's score for a 10 metre fix", () => {
    /* The Java service uses the same log curve; both must agree or the driver
       and passenger would see different numbers for the same fix. */
    expect(accuracyPercent(10)).toBe(77);
  });

  it("bands the score into a label a driver can read at a glance", () => {
    expect(accuracyLabel(accuracyPercent(4))).toBe("Excellent");
    expect(accuracyLabel(accuracyPercent(12))).toBe("Good");
    expect(accuracyLabel(accuracyPercent(25))).toBe("Fair");
    expect(accuracyLabel(accuracyPercent(60))).toBe("Weak");
  });
});

describe("GpsSmoother", () => {
  it("passes the first fix through untouched", () => {
    const smoother = new GpsSmoother();
    const result = smoother.process({
      latitude: LAT,
      longitude: LON,
      accuracy: 5,
      timestamp: T0,
    });

    expect(result.latitude).toBe(LAT);
    expect(result.longitude).toBe(LON);
  });

  it("damps scatter around a parked bus", () => {
    const smoother = new GpsSmoother();
    smoother.process({
      latitude: LAT,
      longitude: LON,
      accuracy: 5,
      timestamp: T0,
    });

    /* A 20 m jump reported with a poor 40 m accuracy is mostly noise, so the
       estimate should barely move towards it. */
    const jittered = smoother.process({
      latitude: LAT + 0.00018,
      longitude: LON,
      accuracy: 40,
      timestamp: T0 + 1000,
    });

    const movedMeters = distanceMeters(LAT, LON, jittered.latitude, jittered.longitude);
    expect(movedMeters).toBeLessThan(5);
  });

  it("keeps up with a bus at speed instead of trailing behind it", () => {
    const smoother = new GpsSmoother();
    let latitude = LAT;
    let last = { latitude: LAT, longitude: LON, accuracy: 5 };

    /* Ten precise fixes marching steadily north. */
    for (let i = 0; i < 10; i++) {
      latitude += 0.0005;
      last = smoother.process({
        latitude,
        longitude: LON,
        accuracy: 5,
        timestamp: T0 + (i + 1) * 2000,
      });
    }

    /* The estimate should be within a few metres of the true position. */
    expect(distanceMeters(latitude, LON, last.latitude, last.longitude)).toBeLessThan(10);
  });

  it("starts fresh after a reset", () => {
    const smoother = new GpsSmoother();
    smoother.process({ latitude: LAT, longitude: LON, accuracy: 5, timestamp: T0 });
    expect(smoother.initialised).toBe(true);

    smoother.reset();
    expect(smoother.initialised).toBe(false);

    const result = smoother.process({
      latitude: LAT + 0.05,
      longitude: LON,
      accuracy: 5,
      timestamp: T0 + 1000,
    });
    expect(result.latitude).toBe(LAT + 0.05);
  });
});

describe("GpsTracker", () => {
  it("publishes the first usable fix with a quality score", () => {
    const tracker = new GpsTracker();
    const result = published(tracker.accept(fix({ accuracy: 4 }), T0));

    expect(result.latitude).toBe(LAT);
    expect(result.accuracyPercent).toBe(100);
  });

  it("rejects a fix that is less precise than the cut-off", () => {
    const tracker = new GpsTracker();
    const decision = tracker.accept(fix({ accuracy: 250 }), T0);

    expect(decision).toEqual({ publish: false, reason: "accuracy-too-low" });
  });

  it("rejects the no-fix (0, 0) placeholder", () => {
    const tracker = new GpsTracker();
    const decision = tracker.accept(fix({ latitude: 0, longitude: 0 }), T0);

    expect(decision).toEqual({ publish: false, reason: "no-fix" });
  });

  it("rejects coordinates outside the valid range", () => {
    const tracker = new GpsTracker();

    expect(tracker.accept(fix({ latitude: 95 }), T0)).toEqual({
      publish: false,
      reason: "invalid-coordinates",
    });
    expect(tracker.accept(fix({ longitude: 200 }), T0)).toEqual({
      publish: false,
      reason: "invalid-coordinates",
    });
  });

  it("rejects a cached reading the OS replays long after it was taken", () => {
    const tracker = new GpsTracker();
    const decision = tracker.accept(fix({ timestamp: T0 - 60_000 }), T0);

    expect(decision).toEqual({ publish: false, reason: "stale-reading" });
  });

  it("rejects a fix that teleports the bus faster than it can drive", () => {
    const tracker = new GpsTracker();
    tracker.accept(fix(), T0);

    /* ~11 km in one second. */
    const decision = tracker.accept(
      fix({ latitude: LAT + 0.1, timestamp: T0 + 1000 }),
      T0 + 1000,
    );

    expect(decision).toEqual({ publish: false, reason: "implausible-jump" });
  });

  it("keeps the last good fix when a bad one is rejected", () => {
    const tracker = new GpsTracker();
    tracker.accept(fix(), T0);
    tracker.accept(fix({ latitude: LAT + 0.1, timestamp: T0 + 1000 }), T0 + 1000);

    expect(tracker.current?.latitude).toBeCloseTo(LAT, 5);
  });

  it("rejects a delayed fix older than the one already published", () => {
    const tracker = new GpsTracker();
    tracker.accept(fix({ timestamp: T0 + 10_000 }), T0 + 10_000);

    const decision = tracker.accept(
      fix({ latitude: LAT + 0.002, timestamp: T0 + 5_000 }),
      T0 + 10_100,
    );

    expect(decision).toEqual({ publish: false, reason: "out-of-order" });
  });

  it("does not republish while the bus sits still", () => {
    const tracker = new GpsTracker();
    tracker.accept(fix(), T0);

    /* A 2 m wobble two seconds later is scatter, not movement. */
    const decision = tracker.accept(
      fix({ latitude: LAT + 0.00002, timestamp: T0 + 2000 }),
      T0 + 2000,
    );

    expect(decision).toEqual({ publish: false, reason: "not-moved" });
  });

  it("still sends a heartbeat while parked so the fix never goes stale", () => {
    const tracker = new GpsTracker();
    tracker.accept(fix(), T0);
    tracker.accept(fix({ latitude: LAT + 0.00002, timestamp: T0 + 2000 }), T0 + 2000);

    const decision = tracker.accept(
      fix({ latitude: LAT + 0.00002, timestamp: T0 + 12_000 }),
      T0 + 12_000,
    );

    expect(decision.publish).toBe(true);
  });

  it("publishes again once the bus has genuinely moved", () => {
    const tracker = new GpsTracker();
    tracker.accept(fix(), T0);

    /* ~55 m north after 5 s, well past the 8 m publish threshold. */
    const decision = tracker.accept(
      fix({ latitude: LAT + 0.0005, timestamp: T0 + 5000 }),
      T0 + 5000,
    );

    expect(decision.publish).toBe(true);
  });

  it("keeps the device speed when the device reports one", () => {
    const tracker = new GpsTracker();
    const result = published(tracker.accept(fix({ speed: 12.5 }), T0));

    expect(result.speed).toBe(12.5);
  });

  it("derives speed from movement when the device reports none", () => {
    const tracker = new GpsTracker();
    tracker.accept(fix({ speed: -1 }), T0);

    /* ~111 m over 10 s is ~11.1 m/s. */
    const result = published(
      tracker.accept(
        fix({ latitude: LAT + 0.001, speed: -1, timestamp: T0 + 10_000 }),
        T0 + 10_000,
      ),
    );

    expect(result.speed).toBeGreaterThan(8);
    expect(result.speed).toBeLessThan(12);
  });

  it("derives a northward heading when the device reports none", () => {
    const tracker = new GpsTracker();
    tracker.accept(fix({ heading: -1 }), T0);

    const result = published(
      tracker.accept(
        fix({ latitude: LAT + 0.001, heading: -1, timestamp: T0 + 10_000 }),
        T0 + 10_000,
      ),
    );

    expect(result.heading).toBeCloseTo(0, 0);
  });

  it("holds the last heading rather than spinning while parked", () => {
    const tracker = new GpsTracker();
    tracker.accept(fix({ heading: 90 }), T0);

    /* Parked for 12 s: the heartbeat publishes, but with no real movement the
       bearing between two scattered fixes would be random, so keep 90. */
    const result = published(
      tracker.accept(
        fix({ latitude: LAT + 0.00001, heading: -1, timestamp: T0 + 12_000 }),
        T0 + 12_000,
      ),
    );

    expect(result.heading).toBe(90);
  });

  it("offers a heartbeat once the OS has gone quiet", () => {
    const tracker = new GpsTracker();
    tracker.accept(fix(), T0);

    /* A phone that is not moving gets no callbacks from the OS at all, so
       nothing would be published and passengers would be told the signal was
       lost while the bus sat at a stop. */
    expect(tracker.heartbeat(T0 + 2_000)).toBeNull();

    const beat = tracker.heartbeat(T0 + 11_000);
    expect(beat).not.toBeNull();
    expect(beat!.latitude).toBe(LAT);
    /* Restamped: the position is still current, only the reading is old. */
    expect(beat!.timestamp).toBe(T0 + 11_000);
  });

  it("does not offer a heartbeat straight after a real publish", () => {
    const tracker = new GpsTracker();
    tracker.accept(fix(), T0);
    tracker.accept(fix({ latitude: LAT + 0.0005, timestamp: T0 + 5000 }), T0 + 5000);

    expect(tracker.heartbeat(T0 + 6_000)).toBeNull();
  });

  it("has no heartbeat to offer before the first fix", () => {
    expect(new GpsTracker().heartbeat(T0)).toBeNull();
  });

  it("clears its history on reset", () => {
    const tracker = new GpsTracker();
    tracker.accept(fix(), T0);
    tracker.reset();

    expect(tracker.current).toBeNull();

    /* Without history, a far-away fix is a fresh start, not a jump. */
    const decision = tracker.accept(
      fix({ latitude: LAT + 0.5, timestamp: T0 + 1000 }),
      T0 + 1000,
    );
    expect(decision.publish).toBe(true);
  });
});
