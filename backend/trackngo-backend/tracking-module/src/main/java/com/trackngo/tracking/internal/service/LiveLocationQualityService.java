package com.trackngo.tracking.internal.service;

import com.trackngo.tracking.api.dto.LiveBusLocationDto;
import com.trackngo.tracking.internal.util.GeoMath;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/*
  Gatekeeper for live GPS fixes coming off driver phones.

  A phone reports a position every couple of seconds, and a meaningful share of
  those reports are wrong: the first fix after a tunnel can be hundreds of
  metres off, a cold start can briefly report the last known cell-tower
  position, and retried network requests can arrive out of order. Forwarding
  those to passengers makes the bus marker jump around the map, which reads as
  "the tracking is broken" even though most fixes were fine.

  This service keeps the last accepted fix per bus and rejects any new fix that
  is impossible or too imprecise to be an improvement, then annotates the
  survivors with a 0-100 quality score so the passenger app can tell the rider
  how much to trust the dot.
*/
@Slf4j
@Service
@RequiredArgsConstructor
public class LiveLocationQualityService {

    /*
      Fixes reporting a horizontal accuracy worse than this are dropped. 100 m
      is roughly the point where a bus could be on either of two parallel
      streets, so the position stops being useful for "where is my bus".
    */
    public static final double MAX_ACCURACY_METERS = 100.0;

    /* A fix at or below this accuracy scores 100%. */
    public static final double EXCELLENT_ACCURACY_METERS = 5.0;

    /*
      Fastest movement we are willing to believe, in metres per second.
      45 m/s is 162 km/h - far above any bus, so anything quicker is a bad fix
      rather than a fast driver.
    */
    public static final double MAX_PLAUSIBLE_SPEED_MPS = 45.0;

    /* A fix older than this no longer describes where the bus is now. */
    public static final long STALE_AFTER_MS = 30_000L;

    /* Confidence starts decaying once a fix is older than this. */
    public static final long FRESH_WINDOW_MS = 5_000L;

    /* Device clocks drift; anything further ahead than this is clamped to now. */
    public static final long MAX_CLOCK_SKEW_MS = 120_000L;

    /* Below this movement the reported heading is noise, so we keep the old one. */
    private static final double MIN_HEADING_DISTANCE_METERS = 5.0;

    /* Latest accepted fix per bus number. */
    private final Map<String, LiveBusLocationDto> latestByBus = new ConcurrentHashMap<>();

    /*
      Outcome of submitting a fix: either the accepted, annotated location or
      the reason it was thrown away.
    */
    @Getter
    public static final class Result {
        private final boolean accepted;
        private final String reason;
        private final LiveBusLocationDto location;

        private Result(boolean accepted, String reason, LiveBusLocationDto location) {
            this.accepted = accepted;
            this.reason = reason;
            this.location = location;
        }

        static Result accepted(LiveBusLocationDto location) {
            return new Result(true, "Bus location published", location);
        }

        static Result rejected(String reason, LiveBusLocationDto lastGood) {
            return new Result(false, reason, lastGood);
        }
    }

    /*
      Validate, filter and annotate an incoming fix.

      @param incoming the fix as reported by the driver device
      @param nowMs    server clock, epoch milliseconds
      @return an accepted location ready to broadcast, or a rejection carrying
              the last known good fix so the caller can still answer the client
    */
    public Result submit(LiveBusLocationDto incoming, long nowMs) {
        if (incoming == null || incoming.getBusNumber() == null || incoming.getBusNumber().isBlank()) {
            return Result.rejected("Bus number is required", null);
        }

        String busNumber = incoming.getBusNumber().trim();
        LiveBusLocationDto previous = latestByBus.get(busNumber);

        Double lat = incoming.getLatitude();
        Double lon = incoming.getLongitude();
        if (lat == null || lon == null || !Double.isFinite(lat) || !Double.isFinite(lon)) {
            return Result.rejected("Latitude and longitude are required", previous);
        }
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return Result.rejected("Coordinates out of range", previous);
        }
        /*
          Exactly (0, 0) is in the Gulf of Guinea and is what a device reports
          when it has no fix at all, so treat it as no data rather than a
          position off the coast of Africa.
        */
        if (lat == 0.0d && lon == 0.0d) {
            return Result.rejected("Null island fix discarded", previous);
        }

        long timestamp = resolveTimestamp(incoming.getTimestamp(), nowMs);

        Double accuracy = incoming.getAccuracy();
        if (accuracy != null && (!Double.isFinite(accuracy) || accuracy < 0)) {
            accuracy = null;
        }
        if (accuracy != null && accuracy > MAX_ACCURACY_METERS) {
            log.debug("Dropping fix for {}: accuracy {}m exceeds {}m", busNumber, accuracy, MAX_ACCURACY_METERS);
            return Result.rejected("GPS accuracy too low (" + Math.round(accuracy) + "m)", previous);
        }

        if (previous != null) {
            long previousTimestamp = previous.getTimestamp() != null ? previous.getTimestamp() : 0L;

            /*
              Retried or delayed requests can arrive after a newer fix. Applying
              them would drag the bus backwards along the route.
            */
            if (timestamp < previousTimestamp) {
                return Result.rejected("Out-of-order fix discarded", previous);
            }

            String jumpReason = detectImplausibleJump(previous, lat, lon, accuracy, timestamp, previousTimestamp);
            if (jumpReason != null) {
                log.debug("Dropping fix for {}: {}", busNumber, jumpReason);
                return Result.rejected(jumpReason, previous);
            }
        }

        LiveBusLocationDto accepted = new LiveBusLocationDto();
        accepted.setBusNumber(busNumber);
        accepted.setLatitude(lat);
        accepted.setLongitude(lon);
        accepted.setAccuracy(accuracy);
        accepted.setTimestamp(timestamp);
        accepted.setServerTimestamp(nowMs);
        accepted.setSpeed(resolveSpeed(incoming.getSpeed(), previous, lat, lon, timestamp));
        accepted.setHeading(resolveHeading(incoming.getHeading(), previous, lat, lon));

        int quality = accuracyPercent(accuracy);
        accepted.setAccuracyPercent(quality);
        accepted.setConfidencePercent(quality);
        accepted.setAgeSeconds(0L);
        accepted.setStale(false);

        latestByBus.put(busNumber, accepted);
        return Result.accepted(accepted);
    }

    /*
      Last known good fix for a bus, annotated with how old it now is.
      Returns empty when nothing has ever been published for that bus.
    */
    public Optional<LiveBusLocationDto> latest(String busNumber, long nowMs) {
        if (busNumber == null || busNumber.isBlank()) {
            return Optional.empty();
        }
        LiveBusLocationDto stored = latestByBus.get(busNumber.trim());
        if (stored == null) {
            return Optional.empty();
        }
        return Optional.of(withFreshness(stored, nowMs));
    }

    /*
      Forget a bus's live position, e.g. when a trip ends.
    */
    public void clear(String busNumber) {
        if (busNumber != null && !busNumber.isBlank()) {
            latestByBus.remove(busNumber.trim());
        }
    }

    /*
      Map a horizontal accuracy radius in metres onto a 0-100 quality score.

      The scale is logarithmic because accuracy is: the difference between 5 m
      and 10 m matters far more to a rider than the difference between 80 m and
      85 m. 5 m or better scores 100, and the cut-off of 100 m scores 0.
    */
    public static int accuracyPercent(Double accuracyMeters) {
        if (accuracyMeters == null || !Double.isFinite(accuracyMeters) || accuracyMeters < 0) {
            /* Device did not report accuracy - assume usable but unverified. */
            return 50;
        }
        if (accuracyMeters <= EXCELLENT_ACCURACY_METERS) {
            return 100;
        }
        if (accuracyMeters >= MAX_ACCURACY_METERS) {
            return 0;
        }
        double span = Math.log(MAX_ACCURACY_METERS / EXCELLENT_ACCURACY_METERS);
        double used = Math.log(accuracyMeters / EXCELLENT_ACCURACY_METERS);
        return (int) Math.round(100.0 * (1.0 - used / span));
    }

    /*
      Fold the age of a fix into its quality score. A pinpoint fix from 25
      seconds ago is not a good answer to "where is the bus now", so confidence
      falls from the fix quality at FRESH_WINDOW_MS down to 0 at STALE_AFTER_MS.
    */
    public static int confidencePercent(int accuracyPercent, long ageMs) {
        if (ageMs <= FRESH_WINDOW_MS) {
            return accuracyPercent;
        }
        if (ageMs >= STALE_AFTER_MS) {
            return 0;
        }
        double decay = 1.0 - (double) (ageMs - FRESH_WINDOW_MS) / (STALE_AFTER_MS - FRESH_WINDOW_MS);
        return (int) Math.round(accuracyPercent * decay);
    }

    /* ── internals ──────────────────────────────────────────── */

    private LiveBusLocationDto withFreshness(LiveBusLocationDto stored, long nowMs) {
        long reference = stored.getServerTimestamp() != null ? stored.getServerTimestamp() : nowMs;
        long ageMs = Math.max(0L, nowMs - reference);

        LiveBusLocationDto copy = new LiveBusLocationDto();
        copy.setBusNumber(stored.getBusNumber());
        copy.setLatitude(stored.getLatitude());
        copy.setLongitude(stored.getLongitude());
        copy.setHeading(stored.getHeading());
        copy.setSpeed(stored.getSpeed());
        copy.setAccuracy(stored.getAccuracy());
        copy.setAccuracyPercent(stored.getAccuracyPercent());
        copy.setTimestamp(stored.getTimestamp());
        copy.setServerTimestamp(stored.getServerTimestamp());
        copy.setAgeSeconds(ageMs / 1000);
        copy.setStale(ageMs >= STALE_AFTER_MS);

        int quality = stored.getAccuracyPercent() != null ? stored.getAccuracyPercent() : 50;
        copy.setConfidencePercent(confidencePercent(quality, ageMs));
        return copy;
    }

    private long resolveTimestamp(Long reported, long nowMs) {
        if (reported == null || reported <= 0) {
            return nowMs;
        }
        /* A device clock running ahead would make every later fix look stale. */
        if (reported > nowMs + MAX_CLOCK_SKEW_MS) {
            return nowMs;
        }
        return reported;
    }

    /*
      Returns a rejection reason when the move from the previous fix is faster
      than a bus can travel, or null when the move is believable.

      The distance is discounted by the accuracy radii of both fixes: two
      imprecise fixes taken in the same spot can legitimately differ by tens of
      metres, and that difference should not be read as movement.
    */
    private String detectImplausibleJump(LiveBusLocationDto previous, double lat, double lon,
                                         Double accuracy, long timestamp, long previousTimestamp) {
        if (previous.getLatitude() == null || previous.getLongitude() == null) {
            return null;
        }

        long deltaMs = timestamp - previousTimestamp;
        if (deltaMs <= 0) {
            return null;
        }

        double distance = GeoMath.distanceMeters(
                previous.getLatitude(), previous.getLongitude(), lat, lon);

        double accuracySlack = (accuracy != null ? accuracy : 0)
                + (previous.getAccuracy() != null ? previous.getAccuracy() : 0);
        double effectiveDistance = Math.max(0, distance - accuracySlack);
        if (effectiveDistance == 0) {
            return null;
        }

        double impliedSpeed = effectiveDistance / (deltaMs / 1000.0);
        if (impliedSpeed > MAX_PLAUSIBLE_SPEED_MPS) {
            return "Implausible jump discarded (" + Math.round(impliedSpeed * 3.6) + " km/h)";
        }
        return null;
    }

    /*
      Prefer the device's own speed. Phones report -1 (or omit the field) when
      they cannot measure it, in which case we derive it from the distance
      covered since the last accepted fix.
    */
    private Double resolveSpeed(Double reported, LiveBusLocationDto previous,
                                double lat, double lon, long timestamp) {
        if (reported != null && Double.isFinite(reported) && reported >= 0) {
            return reported;
        }
        if (previous == null || previous.getLatitude() == null || previous.getTimestamp() == null) {
            return null;
        }
        long deltaMs = timestamp - previous.getTimestamp();
        if (deltaMs <= 0) {
            return null;
        }
        double distance = GeoMath.distanceMeters(
                previous.getLatitude(), previous.getLongitude(), lat, lon);
        double derived = distance / (deltaMs / 1000.0);
        return derived > MAX_PLAUSIBLE_SPEED_MPS ? null : derived;
    }

    /*
      Prefer the device's compass/course heading. When it is missing, derive the
      bearing from the previous fix - but only if the bus actually moved, since
      the bearing between two jittery fixes taken at a bus stop is random.
    */
    private Double resolveHeading(Double reported, LiveBusLocationDto previous, double lat, double lon) {
        if (reported != null && Double.isFinite(reported) && reported >= 0 && reported <= 360) {
            return reported % 360;
        }
        if (previous == null || previous.getLatitude() == null || previous.getLongitude() == null) {
            return null;
        }
        double distance = GeoMath.distanceMeters(
                previous.getLatitude(), previous.getLongitude(), lat, lon);
        if (distance < MIN_HEADING_DISTANCE_METERS) {
            return previous.getHeading();
        }
        return GeoMath.bearingDegrees(previous.getLatitude(), previous.getLongitude(), lat, lon);
    }
}
