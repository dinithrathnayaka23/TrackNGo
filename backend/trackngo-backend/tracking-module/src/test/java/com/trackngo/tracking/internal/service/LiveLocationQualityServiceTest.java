package com.trackngo.tracking.internal.service;

import com.trackngo.tracking.api.dto.LiveBusLocationDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("LiveLocationQualityService Unit Tests")
class LiveLocationQualityServiceTest {

    private static final String BUS = "ND-4589";

    /* Two points in Colombo roughly 111 m apart (0.001 degrees of latitude). */
    private static final double LAT = 6.9271;
    private static final double LON = 79.8612;

    private LiveLocationQualityService service;
    private long now;

    @BeforeEach
    void setUp() {
        service = new LiveLocationQualityService();
        now = 1_700_000_000_000L;
    }

    private LiveBusLocationDto fix(double lat, double lon, Double accuracy, Long timestamp) {
        LiveBusLocationDto dto = new LiveBusLocationDto();
        dto.setBusNumber(BUS);
        dto.setLatitude(lat);
        dto.setLongitude(lon);
        dto.setAccuracy(accuracy);
        dto.setTimestamp(timestamp);
        return dto;
    }

    @Nested
    @DisplayName("Accepting good fixes")
    class GoodFixes {

        @Test
        @DisplayName("accepts a precise fix and annotates it with quality metadata")
        void acceptsPreciseFix() {
            LiveLocationQualityService.Result result =
                    service.submit(fix(LAT, LON, 4.0, now), now);

            assertThat(result.isAccepted()).isTrue();
            LiveBusLocationDto accepted = result.getLocation();
            assertThat(accepted.getLatitude()).isEqualTo(LAT);
            assertThat(accepted.getLongitude()).isEqualTo(LON);
            assertThat(accepted.getAccuracyPercent()).isEqualTo(100);
            assertThat(accepted.getConfidencePercent()).isEqualTo(100);
            assertThat(accepted.getServerTimestamp()).isEqualTo(now);
            assertThat(accepted.getStale()).isFalse();
            assertThat(accepted.getAgeSeconds()).isZero();
        }

        @Test
        @DisplayName("fills in a server timestamp when the device omits one")
        void fillsMissingTimestamp() {
            LiveLocationQualityService.Result result =
                    service.submit(fix(LAT, LON, 8.0, null), now);

            assertThat(result.isAccepted()).isTrue();
            assertThat(result.getLocation().getTimestamp()).isEqualTo(now);
        }

        @Test
        @DisplayName("clamps a device clock that runs far ahead of the server")
        void clampsFutureTimestamp() {
            LiveLocationQualityService.Result result =
                    service.submit(fix(LAT, LON, 8.0, now + 600_000L), now);

            assertThat(result.isAccepted()).isTrue();
            assertThat(result.getLocation().getTimestamp()).isEqualTo(now);
        }

        @Test
        @DisplayName("accepts a bus travelling at a realistic speed")
        void acceptsRealisticMovement() {
            service.submit(fix(LAT, LON, 5.0, now), now);

            /* 0.001 degrees of latitude is ~111 m; over 10 s that is ~40 km/h. */
            LiveLocationQualityService.Result result =
                    service.submit(fix(LAT + 0.001, LON, 5.0, now + 10_000L), now + 10_000L);

            assertThat(result.isAccepted()).isTrue();
        }
    }

    @Nested
    @DisplayName("Rejecting bad fixes")
    class BadFixes {

        @Test
        @DisplayName("rejects a fix whose accuracy radius is worse than the cut-off")
        void rejectsImpreciseFix() {
            LiveLocationQualityService.Result result =
                    service.submit(fix(LAT, LON, 250.0, now), now);

            assertThat(result.isAccepted()).isFalse();
            assertThat(result.getReason()).contains("accuracy too low");
        }

        @Test
        @DisplayName("rejects the no-fix (0, 0) placeholder")
        void rejectsNullIsland() {
            LiveLocationQualityService.Result result = service.submit(fix(0.0, 0.0, 5.0, now), now);

            assertThat(result.isAccepted()).isFalse();
            assertThat(result.getReason()).contains("Null island");
        }

        @Test
        @DisplayName("rejects coordinates outside the valid range")
        void rejectsOutOfRange() {
            assertThat(service.submit(fix(95.0, LON, 5.0, now), now).isAccepted()).isFalse();
            assertThat(service.submit(fix(LAT, 200.0, 5.0, now), now).isAccepted()).isFalse();
        }

        @Test
        @DisplayName("rejects a fix that teleports the bus faster than it can drive")
        void rejectsImplausibleJump() {
            service.submit(fix(LAT, LON, 5.0, now), now);

            /* ~11 km away one second later. */
            LiveLocationQualityService.Result result =
                    service.submit(fix(LAT + 0.1, LON, 5.0, now + 1_000L), now + 1_000L);

            assertThat(result.isAccepted()).isFalse();
            assertThat(result.getReason()).contains("Implausible jump");
        }

        @Test
        @DisplayName("keeps the previous position when a fix is rejected")
        void keepsLastGoodPositionAfterRejection() {
            service.submit(fix(LAT, LON, 5.0, now), now);
            service.submit(fix(LAT + 0.1, LON, 5.0, now + 1_000L), now + 1_000L);

            Optional<LiveBusLocationDto> latest = service.latest(BUS, now + 1_000L);
            assertThat(latest).isPresent();
            assertThat(latest.get().getLatitude()).isEqualTo(LAT);
        }

        @Test
        @DisplayName("rejects a delayed fix that is older than the one already stored")
        void rejectsOutOfOrderFix() {
            service.submit(fix(LAT, LON, 5.0, now + 10_000L), now + 10_000L);

            LiveLocationQualityService.Result result =
                    service.submit(fix(LAT + 0.0002, LON, 5.0, now + 5_000L), now + 10_100L);

            assertThat(result.isAccepted()).isFalse();
            assertThat(result.getReason()).contains("Out-of-order");
        }

        @Test
        @DisplayName("does not treat scatter within the accuracy radius as movement")
        void toleratesJitterWithinAccuracyRadius() {
            /* Two 60 m-accuracy fixes 50 m apart, 1 s apart: that is jitter, not
               a 180 km/h dash, so the accuracy slack must absorb it. */
            service.submit(fix(LAT, LON, 60.0, now), now);

            LiveLocationQualityService.Result result =
                    service.submit(fix(LAT + 0.00045, LON, 60.0, now + 1_000L), now + 1_000L);

            assertThat(result.isAccepted()).isTrue();
        }
    }

    @Nested
    @DisplayName("Derived speed and heading")
    class Derived {

        @Test
        @DisplayName("keeps the device-reported speed when it is valid")
        void keepsReportedSpeed() {
            LiveBusLocationDto dto = fix(LAT, LON, 5.0, now);
            dto.setSpeed(12.5);

            LiveLocationQualityService.Result result = service.submit(dto, now);

            assertThat(result.getLocation().getSpeed()).isEqualTo(12.5);
        }

        @Test
        @DisplayName("derives speed from consecutive fixes when the device reports none")
        void derivesSpeedFromMovement() {
            service.submit(fix(LAT, LON, 5.0, now), now);

            /* ~111 m in 10 s is ~11.1 m/s. */
            LiveLocationQualityService.Result result =
                    service.submit(fix(LAT + 0.001, LON, 5.0, now + 10_000L), now + 10_000L);

            assertThat(result.getLocation().getSpeed()).isCloseTo(11.1, org.assertj.core.data.Offset.offset(0.5));
        }

        @Test
        @DisplayName("derives a northward heading when the device reports none")
        void derivesHeadingFromMovement() {
            service.submit(fix(LAT, LON, 5.0, now), now);

            LiveLocationQualityService.Result result =
                    service.submit(fix(LAT + 0.001, LON, 5.0, now + 10_000L), now + 10_000L);

            assertThat(result.getLocation().getHeading()).isCloseTo(0.0, org.assertj.core.data.Offset.offset(1.0));
        }

        @Test
        @DisplayName("holds the previous heading while the bus is standing still")
        void holdsHeadingWhenStationary() {
            LiveBusLocationDto first = fix(LAT, LON, 5.0, now);
            first.setHeading(90.0);
            service.submit(first, now);

            /* A 0.5 m wobble at a bus stop must not spin the marker around. */
            LiveLocationQualityService.Result result =
                    service.submit(fix(LAT + 0.000005, LON, 5.0, now + 5_000L), now + 5_000L);

            assertThat(result.getLocation().getHeading()).isEqualTo(90.0);
        }
    }

    @Nested
    @DisplayName("Accuracy scoring")
    class Scoring {

        @Test
        @DisplayName("scores 100 for a pinpoint fix and 0 at the cut-off")
        void scoresEndsOfScale() {
            assertThat(LiveLocationQualityService.accuracyPercent(3.0)).isEqualTo(100);
            assertThat(LiveLocationQualityService.accuracyPercent(5.0)).isEqualTo(100);
            assertThat(LiveLocationQualityService.accuracyPercent(100.0)).isZero();
            assertThat(LiveLocationQualityService.accuracyPercent(500.0)).isZero();
        }

        @Test
        @DisplayName("scores 50 when the device reports no accuracy at all")
        void scoresUnknownAccuracy() {
            assertThat(LiveLocationQualityService.accuracyPercent(null)).isEqualTo(50);
        }

        @Test
        @DisplayName("falls monotonically as the accuracy radius grows")
        void scoreDecreasesWithWorseAccuracy() {
            int at10 = LiveLocationQualityService.accuracyPercent(10.0);
            int at25 = LiveLocationQualityService.accuracyPercent(25.0);
            int at60 = LiveLocationQualityService.accuracyPercent(60.0);

            assertThat(at10).isGreaterThan(at25);
            assertThat(at25).isGreaterThan(at60);
            assertThat(at10).isBetween(70, 85);
        }
    }

    @Nested
    @DisplayName("Freshness")
    class Freshness {

        @Test
        @DisplayName("holds full confidence inside the fresh window")
        void fullConfidenceWhenFresh() {
            service.submit(fix(LAT, LON, 4.0, now), now);

            LiveBusLocationDto latest = service.latest(BUS, now + 3_000L).orElseThrow();

            assertThat(latest.getConfidencePercent()).isEqualTo(100);
            assertThat(latest.getStale()).isFalse();
            assertThat(latest.getAgeSeconds()).isEqualTo(3L);
        }

        @Test
        @DisplayName("decays confidence as the fix ages")
        void confidenceDecaysWithAge() {
            service.submit(fix(LAT, LON, 4.0, now), now);

            int at12s = service.latest(BUS, now + 12_000L).orElseThrow().getConfidencePercent();
            int at20s = service.latest(BUS, now + 20_000L).orElseThrow().getConfidencePercent();

            assertThat(at12s).isBetween(60, 80);
            assertThat(at20s).isLessThan(at12s);
        }

        @Test
        @DisplayName("marks a fix stale and zero-confidence past the stale window")
        void marksStale() {
            service.submit(fix(LAT, LON, 4.0, now), now);

            LiveBusLocationDto latest = service.latest(BUS, now + 45_000L).orElseThrow();

            assertThat(latest.getStale()).isTrue();
            assertThat(latest.getConfidencePercent()).isZero();
            /* The coordinates are still returned so the map can show a last-seen marker. */
            assertThat(latest.getLatitude()).isEqualTo(LAT);
        }

        @Test
        @DisplayName("returns empty for a bus that has never reported")
        void emptyForUnknownBus() {
            assertThat(service.latest("NO-SUCH-BUS", now)).isEmpty();
        }

        @Test
        @DisplayName("forgets a bus once its trip is cleared")
        void clearsBus() {
            service.submit(fix(LAT, LON, 4.0, now), now);
            service.clear(BUS);

            assertThat(service.latest(BUS, now)).isEmpty();
        }
    }
}
